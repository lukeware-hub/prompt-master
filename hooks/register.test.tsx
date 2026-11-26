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
  { name: 'model', description: '', source: 'builtin' },
] satisfies CommandInfo[]

// The owner's prompt: the first line becomes the command, the rest its arguments.
const SKILL_ARGS = '/frontend-design:frontend-design\n/design-taste-frontend\neta tudo desalinhado temq ue fira tudo alinha igai a esse'

const run = (command: string, args: string) =>
  ({ command, args, origin: { kind: 'composer' } }) as Args<'command.run'>

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// Stands for the engine: records what reached it and what the model was asked.
// `reply` answers the rewrite (a failure result in place of text), `corrected` the spelling fix ('' fails it),
// and `isCut` makes the rewrite use its whole token cap.
function engine(
  on: On,
  reply: string | ModelCompleteResult = 'Goal: fix the login bug in auth.ts.',
  settings: Record<string, unknown> = {},
  messages: SessionMessage[] = [],
  isCut = false,
  corrected = '',
) {
  const sent: string[] = []
  const asked: string[] = []
  const systems: string[] = []
  const ran: string[] = []
  const limits: { maxTokens?: number; timeoutMs?: number }[] = []
  on('settings.read', () => ({ value: settings }))
  on('command.list', () => ({ value: COMMANDS }))
  on('session.messages', () => ({ value: messages }))
  on('command.run', (_, e) => (ran.push(e.args), { text: '' }))
  on('prompt.submit', (_, e) => (sent.push(e.text), { text: e.text }))
  on('model.complete', (_, e) => {
    asked.push(e.prompt)
    systems.push(e.system ?? '')
    limits.push({ maxTokens: e.maxTokens, timeoutMs: e.timeoutMs })
    const isFix = String(e.system).startsWith('You fix the writing')
    const text = isFix ? corrected : reply
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
  return { sent, asked, systems, ran, limits }
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
  const { sent, asked } = engine(on)

  await $.prompt.submit({ ...PROMPT, text: 'ok' })

  expect(asked).toHaveLength(1)
  expect(sent).toEqual(['Goal: fix the login bug in auth.ts.'])
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
  expect(limits[0]).toEqual({ maxTokens: 2014, timeoutMs: 15280 })
  expect(limits[1]).toEqual({ maxTokens: 12000, timeoutMs: 215000 })
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
  expect(systems[0]).toContain('one short closing line (one sentence, at most 30 words)')
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
