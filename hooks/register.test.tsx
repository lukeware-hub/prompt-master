import { expect, mock, test } from 'claude-code/testing'
import type { Args, CommandInfo, ModelCompleteResult, On, SessionMessage } from 'claude-code'

const PROMPT = {
  text: 'fix the login bug in auth.ts',
  wait: false,
  origin: { kind: 'composer' },
} as const satisfies Args<'prompt.submit'>

const FOOTER = { plugin: 'prompt-master', component: 'SessionMode', props: { modes: [] } } as const

const COMMANDS = [
  { name: 'impeccable', description: '', source: 'plugin' },
  { name: 'frontend-design:frontend-design', description: '', source: 'plugin' },
  { name: 'design-taste-frontend', description: '', source: 'plugin' },
  { name: 'model', description: '', source: 'builtin' },
] satisfies CommandInfo[]

// The owner's prompt: the first line becomes the command, the rest its arguments.
const SKILL_ARGS = '/frontend-design:frontend-design\n/design-taste-frontend\neta tudo desalinhado temq ue fira tudo alinha igai a esse'

const run = (command: string, args: string) =>
  ({ command, args, origin: { kind: 'composer' } }) as Args<'command.run'>

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// Stands for the engine: records what reached it and what the model was asked.
// `reply` answers the rewrite (a failure result in place of text), `corrected` the spelling fix ('' fails it),
// `isCut` makes the rewrite use its whole token cap, and `checked` answers the last check (the rewrite itself when left out, '' fails it).
function engine(
  on: On,
  reply: string | ModelCompleteResult = 'Goal: fix the login bug in auth.ts.',
  settings: Record<string, unknown> = {},
  messages: SessionMessage[] = [],
  isCut = false,
  corrected = '',
  checked?: string,
) {
  const sent: string[] = []
  const asked: string[] = []
  const systems: string[] = []
  const ran: string[] = []
  const limits: { maxTokens?: number; timeoutMs?: number }[] = []
  const calls: { model?: string; effort?: string }[] = []
  on('settings.read', () => ({ value: settings }))
  on('command.list', () => ({ value: COMMANDS }))
  on('session.messages', () => ({ value: messages }))
  on('command.run', (_, e) => (ran.push(e.args), { text: '' }))
  on('prompt.submit', (_, e) => (sent.push(e.text), { text: e.text }))
  on('model.complete', (_, e) => {
    asked.push(e.prompt)
    systems.push(e.system ?? '')
    limits.push({ maxTokens: e.maxTokens, timeoutMs: e.timeoutMs })
    calls.push({ model: e.model, effort: e.effort })
    const isFix = String(e.system).startsWith('You fix the writing')
    const isCheck = String(e.system).startsWith('You check the rewrite')
    const text = isFix ? corrected : isCheck ? (checked ?? reply) : reply
    if (typeof text !== 'string') {
      return { value: text }
    }
    const usage = isCut && !isFix ? { ...USAGE, output_tokens: e.maxTokens ?? 1024 } : USAGE
    const value: ModelCompleteResult = text
      ? { isAnswered: true, text, usage }
      : { isAnswered: false, reason: 'aborted', usage: USAGE }
    return { value }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return { sent, asked, systems, ran, limits, calls }
}

test('a short draft is rewritten from inside draft tags', async ($, on) => {
  const { sent, asked } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual(['Goal: fix the login bug in auth.ts.'])
  expect(asked[0]).toContain('<draft>\nfix the login bug in auth.ts\n</draft>')
})

test('a failed rewrite sends the draft as typed', async ($, on) => {
  const { sent } = engine(on, '')

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([PROMPT.text])
})

test('a one-word draft is rewritten', async ($, on) => {
  const { sent, asked } = engine(on, 'Ok.')

  await $.prompt.submit({ ...PROMPT, text: 'ok' })

  expect(asked).toHaveLength(1)
  expect(sent).toEqual(['Ok.'])
})

test('a draft of only spaces is sent as typed without asking the model', async ($, on) => {
  const { sent, asked } = engine(on)

  await $.prompt.submit({ ...PROMPT, text: '   ' })

  expect(asked).toEqual([])
  expect(sent).toEqual(['   '])
})

test('a long draft is rewritten with a token cap and time limit that grow with it', async ($, on) => {
  const { sent, limits } = engine(on)
  const long = 'x'.repeat(20000)

  await $.prompt.submit(PROMPT)
  await $.prompt.submit({ ...PROMPT, text: long })

  expect(sent).toEqual(['Goal: fix the login bug in auth.ts.', 'Goal: fix the login bug in auth.ts.'])
  expect(limits[0]).toEqual({ maxTokens: 2028, timeoutMs: 30280 })
  expect(limits[1]).toEqual({ maxTokens: 22000, timeoutMs: 230000 })
})

test('a huge draft keeps the token cap and time limit within the model limits', async ($, on) => {
  const { limits } = engine(on)

  await $.prompt.submit({ ...PROMPT, text: 'x'.repeat(500000) })

  expect(limits[0]).toEqual({ maxTokens: 64000, timeoutMs: 300000 })
})

test('a rewrite cut short at its token cap sends the draft as typed when the spelling fix fails too', async ($, on) => {
  const { sent } = engine(on, undefined, {}, [], true)

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([PROMPT.text])
})

const TYPO = { ...PROMPT, text: 'pode cotinuar, mas nao mexe no `authService.ts`' }
const FIXED = 'Pode continuar, mas não mexa no `authService.ts`.'

test('every rewrite is told to fix spelling, accents, grammar and punctuation, short drafts included', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(TYPO)

  expect(systems[0]).toContain('Always fix every spelling mistake, typo, missing or wrong accent, grammar mistake')
  expect(systems[0]).toContain('punctuation mistake')
  expect(systems[0]).toContain('a one-word answer included')
  expect(systems[0]).toContain('return it with only the writing fixes')
  expect(systems[0]).not.toContain('return it unchanged')
  expect(systems[0]).toContain('Never change code, paths, file names, identifiers')
})

test('every fix is told to keep the meaning, and the meaning is read first', async ($, on) => {
  const { systems } = engine(on, undefined, {}, [], true, FIXED)

  await $.prompt.submit(TYPO)

  const rule = 'Every fix must preserve the original meaning of the sentence'
  expect(systems[0]).toContain('identify its meaning')
  expect(systems[0].indexOf('identify its meaning')).toBeLessThan(systems[0].indexOf('build it from these parts'))
  expect(systems[0]).toContain(rule)
  expect(systems[0]).toContain('if the meaning differs in any way, undo that change')
  expect(systems[1]).toContain(rule)
})

test('a short or garbled draft stays short and gets no invented goal', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(TYPO)

  expect(systems[0]).toContain('becomes one or two clear sentences')
  expect(systems[0]).toContain('The four parts are only for long drafts')
  expect(systems[0]).toContain('work out the sentence the user most likely meant')
  expect(systems[0]).toContain('Never add a goal, an improvement, a reason or a request the user did not make')
  expect(systems[0]).toContain('na precisão teste, só revisar o utils.ts code')
})

test('a rewrite cut short still sends the draft with its spelling fixed', async ($, on) => {
  const { sent, systems, asked } = engine(on, undefined, {}, [], true, FIXED)

  await $.prompt.submit(TYPO)

  expect(sent).toEqual([FIXED])
  expect(systems[1]).toStartWith('You fix the writing')
  expect(asked[1]).toBe(`<draft>\n${TYPO.text}\n</draft>`)
})

test('a rewrite that repeats the conversation still sends the draft with its spelling fixed', async ($, on) => {
  const { sent } = engine(on, 'Goal: test it. Context: the installed copy already has the fix and only works after a restart.', {}, SESSION, false, FIXED)

  await $.prompt.submit(TYPO)

  expect(sent).toEqual([FIXED])
})

test('a rewrite refused by the API still sends the draft with its spelling fixed', async ($, on) => {
  const failure: ModelCompleteResult = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE }
  const { sent } = engine(on, failure, {}, [], false, FIXED)

  await $.prompt.submit(TYPO)

  expect(sent).toEqual([FIXED])
})

test('a rewrite that timed out is not asked again and the draft is sent as typed', async ($, on) => {
  const failure: ModelCompleteResult = { isAnswered: false, reason: 'api-error', status: null, error: 'unknown', usage: USAGE }
  const { sent, asked } = engine(on, failure, {}, [], false, FIXED)

  await $.prompt.submit(TYPO)

  expect(asked).toHaveLength(1)
  expect(sent).toEqual([TYPO.text])
})

test('turning it off is stored for the next session', async ($, on) => {
  const stored: unknown[] = []
  on('store.set', (_, e) => (stored.push(e.value), { value: undefined }))
  engine(on)

  await $.command.run({ command: 'prompt-master', args: '' } as Args<'command.run'>)

  expect(stored).toEqual([false])
})

test('a stored off keeps prompts as typed', async ($, on) => {
  mock.store(on, { isOn: false })
  const { sent, asked } = engine(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([PROMPT.text])
  expect(asked).toEqual([])
})

test('the footer keeps what is drawn beneath and adds the toggle', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...FOOTER, surface })

    expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
    expect(await ui.find({ type: 'Button', key: 'prompt-master-toggle' })).toBeDefined()
    await ui.unmount()
  }
})

// Another mod's footer Button keyed "toggle" took this one's clicks.
test('the footer toggle has a key no other mod uses, and a press turns it off and on', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('store.set', () => ({ value: undefined }))
  const { sent } = engine(on)
  const ui = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  const label = async () => (await ui.find({ type: 'Button', key: 'prompt-master-toggle' }))?.props.label

  expect(await ui.find({ type: 'Button', key: 'toggle' })).toBeUndefined()
  await ui.press({ key: 'prompt-master-toggle' })
  expect(await label()).toBe('✦ Prompt Master: off')
  await $.prompt.submit(PROMPT)
  expect(sent).toEqual([PROMPT.text])
  await ui.press({ key: 'prompt-master-toggle' })
  expect(await label()).toBe('✦ Prompt Master: on')
  await ui.unmount()
})

test('the rewrite is written in the Language set in /config', async ($, on) => {
  const { systems } = engine(on, undefined, { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('Write the final prompt in the language "pt-BR", even when the draft is written in another language')
})

const CLOSING = 'Se faltar algum dado, estude primeiro o código e o contexto e depois pergunte antes de agir, em múltipla escolha, com uma opção recomendada e o motivo, em palavras simples.'

test('in Portuguese a rewrite that forgot the closing line gets it added', async ($, on) => {
  const { sent } = engine(on, 'Revise o `utils.ts`.', { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([`Revise o \`utils.ts\`.\n\n${CLOSING}`])
})

test('in Portuguese a rewrite that has its own closing line is not given a second one', async ($, on) => {
  const own = 'Revise o `utils.ts`.\n\nSe faltar algo, estude o código e pergunte em múltipla escolha, com uma opção recomendada.'
  const { sent } = engine(on, own, { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([own])
})

test('other languages are left as the model wrote them', async ($, on) => {
  const { sent } = engine(on, 'Review `utils.ts`.', { language: 'en' })

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual(['Review `utils.ts`.'])
})

test('in Portuguese the spelling-only fallback also gets the closing line', async ($, on) => {
  const { sent } = engine(on, undefined, { language: 'pt-BR' }, [], true, FIXED)

  await $.prompt.submit(TYPO)

  expect(sent).toEqual([`${FIXED}\n\n${CLOSING}`])
})

test('programming words in English are only spell-fixed, never translated', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('Programming words written in English')
  expect(systems[0]).toContain('only fix their spelling, never translate them')
})

test('with no Language set the rewrite keeps the draft language', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain("Write the final prompt in the draft's own language")
})

test('the rewrite ends by asking for missing facts as multiple choice with a recommendation', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('multiple-choice question')
  expect(systems[0]).toContain('recommended')
  expect(systems[0]).toContain('one closing line (one sentence)')
  expect(systems[0]).not.toContain('at most 30 words')
  expect(systems[0]).not.toContain('never add questions')
})

test('the text after a skill command is rewritten and the command lines are kept', async ($, on) => {
  const { ran, asked } = engine(on, 'Goal: align everything like the screenshot.')

  await $.command.run(run('impeccable', SKILL_ARGS))

  expect(asked[0]).toContain('<draft>\neta tudo desalinhado temq ue fira tudo alinha igai a esse\n</draft>')
  expect(ran).toEqual([
    '/frontend-design:frontend-design\n/design-taste-frontend\nGoal: align everything like the screenshot.',
  ])
})

test('a built-in command keeps its arguments as typed', async ($, on) => {
  const { ran, asked } = engine(on)

  await $.command.run(run('model', 'claude-sonnet-with-a-long-name'))

  expect(ran).toEqual(['claude-sonnet-with-a-long-name'])
  expect(asked).toEqual([])
})

test('a skill command keeps its arguments when the plugin is off', async ($, on) => {
  mock.store(on, { isOn: false })
  const { ran, asked } = engine(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(run('impeccable', SKILL_ARGS))

  expect(ran).toEqual([SKILL_ARGS])
  expect(asked).toEqual([])
})

test('a skill command with short text is rewritten', async ($, on) => {
  const { ran, asked } = engine(on, 'Goal: fix it.')

  await $.command.run(run('impeccable', 'fix it'))

  expect(asked).toHaveLength(1)
  expect(ran).toEqual(['Goal: fix it.'])
})

test('a failed rewrite runs the skill command as typed', async ($, on) => {
  const { ran } = engine(on, '')

  await $.command.run(run('impeccable', SKILL_ARGS))

  expect(ran).toEqual([SKILL_ARGS])
})

const said = (role: SessionMessage['role'], text: string): SessionMessage => ({ role, text, toolUses: [] })

test('the end of the last assistant reply is sent as session context', async ($, on) => {
  const reply = 'a'.repeat(9000) + ' Next step: fix the token check in auth.ts?'
  const { asked } = engine(on, undefined, {}, [
    said('assistant', 'old reply about the footer'),
    said('user', 'my earlier question about the footer'),
    said('assistant', reply),
  ])

  await $.prompt.submit({ ...PROMPT, text: 'sim, pode continuar' })

  expect(asked[0]).toBe(`<session>\n${reply.slice(-8000)}\n</session>\n<draft>\nsim, pode continuar\n</draft>`)
})

test('user messages never reach the session context', async ($, on) => {
  const { asked } = engine(on, undefined, {}, [said('assistant', 'Done.'), said('user', 'secret user text')])

  await $.prompt.submit(PROMPT)

  expect(asked[0]).toContain('<session>\nDone.\n</session>')
  expect(asked[0]).not.toContain('secret user text')
})

test('with no assistant reply only the draft is sent', async ($, on) => {
  const { sent, asked } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(asked[0]).toBe('<draft>\nfix the login bug in auth.ts\n</draft>')
  expect(sent).toEqual(['Goal: fix the login bug in auth.ts.'])
})

test('the session context may only clarify the draft, never add facts', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('<session>')
  expect(systems[0]).toContain('never add goals, facts, files or requirements from it')
  expect(systems[0]).toContain('never turn it into a new task')
})

test('a short answer to the last reply stays a short, explicit answer', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('one or two sentences with none of the four parts')
  expect(systems[0]).toContain('<draft>\nyes, go ahead\n</draft>')
  expect(systems[0]).toContain('Output: Yes, delete the old branch fix/login-retry.')
})

test('the rewrite adds no facts from the session that the draft does not give', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('never copy facts, files, numbers or requirements from the session')
  expect(systems[0]).toContain('only facts written in the draft, never ones from the session')
  expect(systems[0]).toContain('<draft>\nnow add a test for the expired token case\n</draft>')
  expect(systems[0]).toContain('Output: Goal: add a test for the expired token case.')
  expect(systems[0]).toContain('Not: Context: auth.ts changed, 12 tests pass, version 0.4.2 is ready.')
})

const SESSION = [said('assistant', 'I installed version 0.6.0 here. It only works after a restart. The installed copy already has the fix.')]

test('a rewrite that repeats sentences from the session is dropped and the draft is sent as typed', async ($, on) => {
  const { sent } = engine(on, 'Goal: test it. Context: the installed copy already has the fix and only works after a restart.', {}, SESSION)

  await $.prompt.submit({ ...PROMPT, text: 'restarted, test if it works' })

  expect(sent).toEqual(['restarted, test if it works'])
})

test('a rewrite that only names the subject from the session is kept', async ($, on) => {
  const { sent } = engine(on, 'I restarted. Test if version 0.6.0 works now.', {}, SESSION)

  await $.prompt.submit({ ...PROMPT, text: 'restarted, test if it works' })

  expect(sent).toEqual(['I restarted. Test if version 0.6.0 works now.'])
})

test('a short answer rewritten by repeating the question is sent as typed', async ($, on) => {
  const question = [said('assistant', 'Should I make version 0.6.1 that adds one test for each rule? Do it now?')]
  const { sent } = engine(on, 'Yes, make version 0.6.1 that adds one test for each rule now.', {}, question)

  await $.prompt.submit({ ...PROMPT, text: 'yes do it, go on' })

  expect(sent).toEqual(['yes do it, go on'])
})

test('a short answer that names the choice it answers is kept, not dropped as a copy', async ($, on) => {
  const question = [said('assistant', 'Should I also delete the old branch fix/login-retry? 1) delete it 2) keep it')]
  const { sent } = engine(on, 'Yes, delete the old branch fix/login-retry.', {}, question)

  await $.prompt.submit({ ...PROMPT, text: 'yes' })

  expect(sent).toEqual(['Yes, delete the old branch fix/login-retry.'])
})

test('a copy that ends a sentence is still caught', async ($, on) => {
  const session = [said('assistant', 'The installed copy already has the fix and only works after a restart. Version 0.6.0 is ready.')]
  const copy = 'Goal: test it. Context: the installed copy already has the fix and only works after a restart.'
  const { sent } = engine(on, copy, {}, session)

  await $.prompt.submit({ ...PROMPT, text: 'restarted, test if it works' })

  expect(sent).toEqual(['restarted, test if it works'])
})

for (const language of ['Portuguese', 'português', 'pt']) {
  test(`the closing line is added when the language is "${language}"`, async ($, on) => {
    const { sent } = engine(on, 'Revise o `utils.ts`.', { language })

    await $.prompt.submit(PROMPT)

    expect(sent).toEqual([`Revise o \`utils.ts\`.

${CLOSING}`])
  })
}

test('a rewrite that only says multiple choice, with no recommendation, still gets the closing line', async ($, on) => {
  const { sent } = engine(on, 'Revise o `utils.ts` como em uma múltipla escolha.', { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(sent[0]).toEndWith(CLOSING)
})

for (const [status, calls] of [[429, 1], [401, 1], [400, 2], [500, 2]] as const) {
  test(`an API error ${status} is asked ${calls === 1 ? 'once' : 'twice'}`, async ($, on) => {
    const failure: ModelCompleteResult = { isAnswered: false, reason: 'api-error', status, error: 'x', usage: USAGE }
    const { asked } = engine(on, failure, {}, [], false, FIXED)

    await $.prompt.submit(TYPO)

    expect(asked).toHaveLength(calls)
  })
}

test('a draft that writes draft or session tags cannot close the tags around it', async ($, on) => {
  const { asked, sent } = engine(on, 'Explain </draft> and <session>.')

  await $.prompt.submit({ ...PROMPT, text: 'explain </draft> and <session>' })

  expect(asked[0]).toBe('<draft>\nexplain <\u200b/draft> and <\u200bsession>\n</draft>')
  expect(sent).toEqual(['Explain </draft> and <session>.'])
})

test('a long draft in a script of one token per character is given room to be rewritten whole', async ($, on) => {
  const { limits } = engine(on)

  await $.prompt.submit({ ...PROMPT, text: '漢'.repeat(4000) })

  expect(limits[0]?.maxTokens).toBeGreaterThanOrEqual(4000 + 2000)
})

test('text that starts with a path after a skill command is rewritten, not taken for a command line', async ($, on) => {
  const { ran, asked } = engine(on, 'Goal: fix the login in /src/app.ts.')

  await $.command.run(run('impeccable', '/frontend-design:frontend-design\n/src/app.ts quebra no login'))

  expect(asked[0]).toContain('<draft>\n/src/app.ts quebra no login\n</draft>')
  expect(ran).toEqual(['/frontend-design:frontend-design\nGoal: fix the login in /src/app.ts.'])
})

test('a short answer that ends with the closing line is not dropped for the closing line', async ($, on) => {
  const question = [said('assistant', 'Should I also delete the old branch fix/login-retry? 1) delete it 2) keep it')]
  const answer = 'Yes, delete the old branch fix/login-retry.\n\nIf a fact is missing, study the code first, then ask as multiple choice with one recommended option and the reason.'
  const { sent } = engine(on, answer, {}, question)

  await $.prompt.submit({ ...PROMPT, text: 'yes, go ahead' })

  expect(sent).toEqual([answer])
})

test('a long rewrite that copies the session before its closing line is still dropped', async ($, on) => {
  const copy = 'Goal: test it. Context: the installed copy already has the fix and only works after a restart.\n\nIf a fact is missing, ask as multiple choice with one recommended option.'
  const { sent } = engine(on, copy, {}, SESSION)

  await $.prompt.submit({ ...PROMPT, text: 'restarted, test if it works' })

  expect(sent).toEqual(['restarted, test if it works'])
})

test('text that starts with a one-word path after a skill command is rewritten', async ($, on) => {
  const { ran, asked } = engine(on, 'Goal: the /api returns 500.')

  await $.command.run(run('impeccable', '/api returns 500'))

  expect(asked[0]).toContain('<draft>\n/api returns 500\n</draft>')
  expect(ran).toEqual(['Goal: the /api returns 500.'])
})

test('the closing line is not doubled when the model words it differently', async ($, on) => {
  const own = 'Revise o `utils.ts`.\n\nSe faltar algo, pergunte em múltiplas escolhas, com uma opção sugerida.'
  const { sent } = engine(on, own, { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([own])
})

test('the closing line is added when the language is Brazilian Portuguese', async ($, on) => {
  const { sent } = engine(on, 'Revise o `utils.ts`.', { language: 'Brazilian Portuguese' })

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([`Revise o \`utils.ts\`.\n\n${CLOSING}`])
})

test('a reply of only spaces and invisible characters sends the draft as typed', async ($, on) => {
  const { sent } = engine(on, '\u200b \u200b')

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([PROMPT.text])
})

test('an invisible character the user typed is kept', async ($, on) => {
  const { sent } = engine(on, 'Explain a\u200bb.')

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual(['Explain a\u200bb.'])
})

test('a tag written with a space inside is also kept from closing the draft', async ($, on) => {
  const { asked } = engine(on)

  await $.prompt.submit({ ...PROMPT, text: 'explain < /draft> please' })

  expect(asked[0]).toBe('<draft>\nexplain <\u200b /draft> please\n</draft>')
})

test('a session that cannot read the saved choice still starts with rewriting on', async ($, on) => {
  on('store.get', () => {
    throw new Error('unreadable')
  })
  const { sent } = engine(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit(PROMPT)

  expect(sent).toEqual(['Goal: fix the login bug in auth.ts.'])
})

test('a one-line rewrite about multiple choice is checked whole and still dropped when it copies the session', async ($, on) => {
  const copy = 'Goal: test it. Context: the installed copy already has the fix and only works after a restart. Ask as multiple choice.'
  const { sent } = engine(on, copy, {}, SESSION)

  await $.prompt.submit({ ...PROMPT, text: 'restarted, test if it works' })

  expect(sent).toEqual(['restarted, test if it works'])
})

test('a draft that talks about multiple choice does not hide the missing closing line', async ($, on) => {
  const { sent } = engine(on, 'Adicione uma pergunta de múltipla escolha com a opção recomendada.', { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(sent[0]).toEndWith(CLOSING)
})

test('the closing line worded "escolha múltipla" is not doubled', async ($, on) => {
  const own = 'Revise o `utils.ts`.\n\nSe faltar algo, pergunte em escolha múltipla, com uma opção recomendada.'
  const { sent } = engine(on, own, { language: 'pt-PT' })

  await $.prompt.submit(PROMPT)

  expect(sent).toEqual([own])
})

test('a short answer ending with a Spanish closing line is not dropped as a copy', async ($, on) => {
  const question = [said('assistant', '¿Borro también la rama fix/login-retry? 1) borrarla 2) dejarla')]
  const answer = 'Sí, borra la rama fix/login-retry.\n\nSi falta un dato, estudia primero el código y pregunta en opción múltiple, con una opción recomendada y el motivo.'
  const { sent } = engine(on, answer, { language: 'es' }, question)

  await $.prompt.submit({ ...PROMPT, text: 'sí, adelante' })

  expect(sent).toEqual([answer])
})

test('a space the user typed after a less-than sign is kept', async ($, on) => {
  const { asked, sent } = engine(on, 'If x <\u200b session limit.')

  await $.prompt.submit({ ...PROMPT, text: 'if x < session limit' })

  expect(asked[0]).toBe('<draft>\nif x <\u200b session limit\n</draft>')
  expect(sent).toEqual(['If x < session limit.'])
})

test('the rewrite and the spelling fallback both use sonnet with medium effort', async ($, on) => {
  const { calls } = engine(on, undefined, {}, [], true, FIXED)

  await $.prompt.submit(TYPO)

  expect(calls).toEqual([
    { model: 'sonnet', effort: 'medium' },
    { model: 'sonnet', effort: 'medium' },
  ])
})

test('a short draft whose rewrite lost a word is checked again and the checked text is sent', async ($, on) => {
  const { sent, asked, systems } = engine(on, 'Pode fazer.', {}, [], false, '', 'Já pode fazer.')

  await $.prompt.submit({ ...PROMPT, text: 'jar pode fazer' })

  expect(asked).toHaveLength(2)
  expect(systems[1]).toStartWith('You check the rewrite')
  expect(asked[1]).toBe('<draft>\njar pode fazer\n</draft>\n<rewrite>\nPode fazer.\n</rewrite>')
  expect(sent).toEqual(['Já pode fazer.'])
})

test('a rewrite that keeps the size of the draft costs one call only', async ($, on) => {
  const { asked } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(asked).toHaveLength(1)
})

test('a rewrite that changed a code word of the draft is checked again', async ($, on) => {
  const { asked } = engine(on, 'Rode o build e confira o tsconfig.')

  await $.prompt.submit({ ...PROMPT, text: 'roda `npm run build` e confere o tsconfig.json' })

  expect(asked).toHaveLength(2)
})

test('a short draft that gained words is checked again', async ($, on) => {
  const { asked, sent } = engine(on, 'Já pode fazer: crie a tag v1.2 e publique a release agora.', {}, [], false, '', 'Já pode fazer.')

  await $.prompt.submit({ ...PROMPT, text: 'jar pode fazer' })

  expect(asked).toHaveLength(2)
  expect(sent).toEqual(['Já pode fazer.'])
})

test('a final check that fails sends the draft with its spelling fixed', async ($, on) => {
  const { sent, asked, systems } = engine(on, 'Pode fazer.', {}, [], false, 'Já pode fazer.', '')

  await $.prompt.submit({ ...PROMPT, text: 'jar pode fazer' })

  expect(asked).toHaveLength(3)
  expect(systems[2]).toStartWith('You fix the writing')
  expect(sent).toEqual(['Já pode fazer.'])
})

test('a final check that copies the conversation sends the draft with its spelling fixed', async ($, on) => {
  const copy = 'Goal: test it. Context: the installed copy already has the fix and only works after a restart.'
  const { sent } = engine(on, 'Test it.', {}, SESSION, false, 'Restarted, test if it works.', copy)

  await $.prompt.submit({ ...PROMPT, text: 'restarted, test if it works' })

  expect(sent).toEqual(['Restarted, test if it works.'])
})

test('the spelling fix sees the end of the last reply to understand the draft', async ($, on) => {
  const { asked, systems } = engine(on, undefined, {}, SESSION, true, FIXED)

  await $.prompt.submit(TYPO)

  expect(asked[1]).toBe(`<session>\n${SESSION[0].text}\n</session>\n<draft>\n${TYPO.text}\n</draft>`)
  expect(systems[1]).toContain('<session>')
  expect(systems[1]).toContain('add nothing from it to the output')
})

test('a technical word that does not fit the context is a typing mistake, and one that fits stays', async ($, on) => {
  const { systems } = engine(on, undefined, {}, [], true, FIXED)

  await $.prompt.submit(TYPO)

  for (const system of systems) {
    expect(system).toContain('"jar" typed for "já" in "jar pode fazer"')
    expect(system).toContain('keep the technical word only when the sentence or the session is about that technology')
    expect(system).toContain('Start every sentence with a capital letter')
  }
  expect(systems[0]).toContain('Output: Já pode fazer.')
  expect(systems[0]).toContain('keeps every word that carries meaning')
})

test('the last check uses sonnet with medium effort', async ($, on) => {
  const { calls } = engine(on, 'Pode fazer.', {}, [], false, '', 'Já pode fazer.')

  await $.prompt.submit({ ...PROMPT, text: 'jar pode fazer' })

  expect(calls).toEqual([
    { model: 'sonnet', effort: 'medium' },
    { model: 'sonnet', effort: 'medium' },
  ])
})

test('the last check is told to keep technical words, drop nothing and add nothing from the session', async ($, on) => {
  const { systems } = engine(on, 'Pode fazer.', {}, [], false, '', 'Já pode fazer.')

  await $.prompt.submit({ ...PROMPT, text: 'jar pode fazer' })

  expect(systems[1]).toContain('drops no word that carries meaning')
  expect(systems[1]).toContain('adds no task, fact, file or request that the draft did not make')
  expect(systems[1]).toContain('keeps every technical or code word that fits the sentence and the session')
})

test('a short answer that names the choice it answers costs one call only', async ($, on) => {
  const question = [said('assistant', 'Should I also delete the old branch fix/login-retry? 1) delete it 2) keep it')]
  const { asked, sent } = engine(on, 'Yes, delete the old branch fix/login-retry.', {}, question)

  await $.prompt.submit({ ...PROMPT, text: 'yes' })

  expect(asked).toHaveLength(1)
  expect(sent).toEqual(['Yes, delete the old branch fix/login-retry.'])
})

test('the last check knows that a short answer may name the choice it answers', async ($, on) => {
  const { systems } = engine(on, 'Pode fazer.', {}, [], false, '', 'Já pode fazer.')

  await $.prompt.submit({ ...PROMPT, text: 'jar pode fazer' })

  expect(systems[1]).toContain('may name the choice the session asked about; that is not an addition')
})

test('the labels of the four parts are written in the language of the prompt', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('Write the part labels in the same language as the prompt (in Portuguese: Objetivo, Contexto, Restrições, Resultado esperado)')
})

test('an informal imperative is kept as typed and only a negative one changes form', async ($, on) => {
  const { systems } = engine(on, undefined, {}, [], true, FIXED)

  await $.prompt.submit(TYPO)

  for (const system of systems) {
    expect(system).toContain('An informal imperative (roda, faz, adiciona, abre) is correct Portuguese')
    expect(system).toContain('roda is not execute')
    expect(system).toContain('não mexe becomes não mexa')
  }
  expect(systems[0]).toContain('só revisa o `utils.ts`')
})

test('a word that fits both as a technical word and as a common word is kept as typed', async ($, on) => {
  const { systems } = engine(on, undefined, {}, [], true, FIXED)

  await $.prompt.submit(TYPO)

  for (const system of systems) {
    expect(system).toContain('when the session itself is about that technology and the sentence also fits it, keep the word as typed')
  }
})

test('the user keeps their own verbs, with an example of an informal imperative kept', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain("Keep the user's own verbs and their form")
  expect(systems[0]).toContain('Output: Roda os testes e faz o commit.')
  expect(systems[0]).toContain('Not: Rode os testes e faça o commit.')
  expect(systems[0]).toContain('an informal imperative is not a mistake')
})

test('in Portuguese the four labels left in English are written in Portuguese', async ($, on) => {
  const long = 'Goal: revisar o login.\n\nContext:\n- o erro aparece no `auth.ts`.\n\n**Constraints:**\n- não mexa no `legacy.js`.\n\nExpected result: um resumo.'
  const { sent } = engine(on, long, { language: 'pt-BR' })

  await $.prompt.submit({ ...PROMPT, text: 'revisa o login, o erro aparece no `auth.ts`, nao mexa no `legacy.js` e quero um resumo' })

  expect(sent[0]).toStartWith('Objetivo: revisar o login.')
  expect(sent[0]).toContain('\n\nContexto:\n')
  expect(sent[0]).toContain('**Restrições:**')
  expect(sent[0]).toContain('\n\nResultado esperado: um resumo.')
  expect(sent[0]).not.toMatch(/Goal|Constraints|Expected result/)
})

test('in other languages and with no language the labels are left as the model wrote them', async ($, on) => {
  const long = 'Goal: review the login.\n\nContext: the error is in `auth.ts`.'
  const { sent } = engine(on, long, { language: 'en' })

  await $.prompt.submit({ ...PROMPT, text: 'review the login, the error is in `auth.ts`' })

  expect(sent).toEqual([long])
})

test('a line that only starts with a label word inside the text is left alone in Portuguese', async ($, on) => {
  const reply = 'Revise o `utils.ts`.\n\nO Context: do React muda.'
  const { sent } = engine(on, reply, { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(sent[0]).toContain('O Context: do React muda.')
})

test('the prompt says the user verbs are final and that a technical word is ambiguous only when the session is about it', async ($, on) => {
  const { systems } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain("THE USER'S VERBS ARE FINAL")
  expect(systems[0]).toContain('Turning an informal imperative into a formal one is an error, not a fix')
  expect(systems[0]).toContain('AMBIGUOUS WORDS: this applies only when the session itself is about a technical word')
  expect(systems[0]).toContain('a technical word that does not fit the sentence is a mistyped common word and is fixed')
})
