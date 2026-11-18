import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const isOn = atom({ plugin: 'prompt-master', key: 'isOn' } as const, true)

const SYSTEM = `You turn a user's draft into a better prompt for a coding assistant. You never answer or execute the draft.

Write the final prompt in the draft's own language, in the user's voice, keeping its intent.

Build it from these parts, in this order. Include a part only when the draft gives material for it; skip empty parts instead of filling them:
1. Goal: one or two sentences saying exactly what the final result must achieve.
2. Context: every fact the draft gives (files, errors, tools, background), kept as written.
3. Constraints: limits and requirements from the draft (scope, style, what not to touch, tests, deadlines), as a short list.
4. Expected result: the form and type of the answer wanted (code change, explanation, plan, list, review) and how to tell it is done.

Rules:
- Fidelity: never invent facts, files, names, numbers or requirements. If something is missing, leave it out; never add questions, notes or closing lines of your own.
- Keep every specific detail from the draft (names, paths, quotes, code); never generalize them.
- Clear and short: plain words, no filler, no repetition; a simple draft stays a short prompt.
- If the draft is already clear and complete, return it unchanged.
- Output only the final prompt: no preface, no explanation, no quotes, no code fences around it.`

async function toggle($: EngineInterface) {
  await update($, isOn, v => !v)
  const active = await read($, isOn)
  $.ui.toast(`Prompt Master: ${active ? 'on' : 'off'}`)
  return active
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    const isSkipped =
      !(await read($, isOn)) || e.command || e.isMeta || e.origin.kind !== 'composer' || e.text.trim().length < 12

    if (isSkipped) {
      return next(e)
    }

    const r = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt: e.text,
      maxTokens: 2000,
      effort: 'low',
      timeoutMs: 15000,
    })

    // On any failure, send the original prompt untouched.
    return next(r.isAnswered && r.text.trim() ? { ...e, text: r.text.trim() } : e)
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'prompt-master', description: 'Turn prompt rewriting on or off' })
    return next(e)
  })

  on('command.run', { command: 'prompt-master' }, async $ => ({
    text: `Prompt Master: ${(await toggle($)) ? 'on' : 'off'}`,
  }))

  // Footer row, beside the mode labels (like "Accept edits").
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const active = await read($, isOn)

    return (
      <Box>
        {e.props.modes.length > 0 && <Text dimColor>{e.props.modes.join(' & ')} </Text>}
        <Button
          key="toggle"
          label={active ? '✦ Prompt Master: on' : '✦ Prompt Master: off'}
          variant={active ? 'primary' : 'secondary'}
          onPress={() => toggle($)}
        />
      </Box>
    )
  })
}
