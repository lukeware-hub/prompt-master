import { expect, mock, test } from 'claude-code/testing'
import type { Args, ModelCompleteResult, On } from 'claude-code'

const PROMPT = {
  text: 'fix the login bug in auth.ts',
  wait: false,
  origin: { kind: 'composer' },
} as const satisfies Args<'prompt.submit'>

const FOOTER = { plugin: 'prompt-master', component: 'SessionMode', props: { modes: [] } } as const

const COMMANDS = [
  { name: 'impeccable', description: '', source: 'plugin' },
  { name: 'model', description: '', source: 'builtin' },
] as const

// The owner's prompt: the first line becomes the command, the rest its arguments.
const SKILL_ARGS = '/frontend-design:frontend-design\n/design-taste-frontend\neta tudo desalinhado temq ue fira tudo alinha igai a esse'

const run = (command: string, args: string) =>
  ({ command, args, origin: { kind: 'composer' } }) as Args<'command.run'>

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// Stands for the engine: records what reached it and what the model was asked.
function engine(on: On, reply = 'Goal: fix the login bug in auth.ts.', settings: Record<string, unknown> = {}) {
  const sent: string[] = []
  const asked: string[] = []
  const systems: string[] = []
  const ran: string[] = []
  on('settings.read', () => ({ value: settings }))
  on('command.list', () => ({ value: COMMANDS }))
  on('command.run', (_, e) => (ran.push(e.args), { text: '' }))
  on('prompt.submit', (_, e) => (sent.push(e.text), { text: e.text }))
  on('model.complete', (_, e) => {
    asked.push(e.prompt)
    systems.push(e.system ?? '')
    const value: ModelCompleteResult = reply
      ? { isAnswered: true, text: reply, usage: USAGE }
      : { isAnswered: false, reason: 'aborted', usage: USAGE }
    return { value }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return { sent, asked, systems, ran }
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

test('a draft over 4000 characters is sent as typed without asking the model', async ($, on) => {
  const { sent, asked } = engine(on)
  const long = 'x'.repeat(4001)

  await $.prompt.submit({ ...PROMPT, text: long })

  expect(sent).toEqual([long])
  expect(asked).toEqual([])
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
    expect(await ui.find({ type: 'Button', key: 'toggle' })).toBeDefined()
    await ui.unmount()
  }
})

test('the rewrite is written in the Language set in /config', async ($, on) => {
  const { systems } = engine(on, undefined, { language: 'pt-BR' })

  await $.prompt.submit(PROMPT)

  expect(systems[0]).toContain('Write the final prompt in the language "pt-BR", even when the draft is written in another language')
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

test('a skill command with short text keeps its arguments', async ($, on) => {
  const { ran, asked } = engine(on)

  await $.command.run(run('impeccable', 'fix it'))

  expect(ran).toEqual(['fix it'])
  expect(asked).toEqual([])
})

test('a failed rewrite runs the skill command as typed', async ($, on) => {
  const { ran } = engine(on, '')

  await $.command.run(run('impeccable', SKILL_ARGS))

  expect(ran).toEqual([SKILL_ARGS])
})
