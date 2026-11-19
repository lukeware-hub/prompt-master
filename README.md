# Prompt Master

Rewrites each prompt you send into a clearer, more specific and more complete one, using a fast model, before the assistant reads it.

The rewritten prompt follows four parts: goal, context, constraints and expected result. It ends with one short line (one sentence, at most 30 words) asking the assistant to study the code first and then ask any needed question as multiple choice, with one recommended option and the reason for it. It is written in the Language set in `/config` (for example `pt-BR`), with correct accents, or in your draft's language when none is set. It keeps your intent and never invents facts, files or requirements. If the rewrite fails or takes too long, your original prompt is sent as typed.

## Use

- A `✦ Prompt Master` button sits in the prompt footer. Click it to turn rewriting on or off.
- The command `/prompt-master` does the same.
- To understand short replies such as "yes" or "continue", it also reads up to 500 characters from the end of the assistant's last reply; it uses them only to make your words clear, never to add requests. If the rewrite repeats three or more three-word runs from that reply that you did not type, it is dropped and your prompt is sent as typed, with a toast saying so.
- Spelling, accents, grammar and punctuation are always fixed, in every prompt, short or long; code, paths, names, commands and quoted text stay as typed. When a rewrite is dropped (it repeated the conversation, came back cut short, or the API refused it), a second quick call fixes only the writing and that is sent, with a toast saying so; if that fails too, or the rewrite timed out, the prompt is sent as typed.
- Every prompt is rewritten, short or long; only empty prompts and the commands built into Claude Code are left as typed.
- After a skill or plugin command, such as `/impeccable`, only the text is rewritten; the command lines stay as typed.
- The rewrite's token cap and time limit grow with the prompt's length, so a long paste is rewritten whole. If the rewrite still comes back cut short, the prompt is sent as typed, with a toast saying so.
- While a prompt is being rewritten, the status line shows `✦ Prompt Master: rewriting…`.
- Your on or off choice is saved and stays the same in new sessions.

## Install

You need Claude Code installed.

**In the Claude Code terminal**, type at the prompt:

```
/plugin install prompt-master --marketplace lukeware-hub/prompt-master
```

1. Answer `y` to add the marketplace.
2. Press Enter to install for your user (all your projects).
3. Done: the `✦ Prompt Master` button appears in the prompt footer.

**From a shell**, the same in one line:

```
claude plugin install prompt-master --marketplace lukeware-hub/prompt-master
```

**In the Claude desktop app**: click **+** next to the prompt box, then **Plugins**, **Add marketplace**, type `lukeware-hub/prompt-master`, then **Add plugin**.

## Uninstall

```
/plugin uninstall prompt-master
```

## License

MIT. See [LICENSE](LICENSE).
