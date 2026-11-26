# Prompt Master

Rewrites each prompt you send into a clearer, more specific and more complete one, using a fast model, before the assistant reads it.

The rewritten prompt follows four parts: goal, context, constraints and expected result. It ends with one short line (one sentence, at most 30 words) asking the assistant to study the code first and then ask any needed question as multiple choice, with one recommended option and the reason for it. It is written in the Language set in `/config` (for example `pt-BR`), with correct accents, or in your draft's language when none is set. It keeps your intent and never invents facts, files or requirements. If the rewrite fails or takes too long, your original prompt is sent as typed.

## Use

- A `✦ Prompt Master` button sits in the prompt footer. Click it to turn rewriting on or off.
- The command `/prompt-master` does the same.
- To understand short replies such as "yes" or "continue", it also reads up to 2000 tokens from the end of the assistant's last reply; it uses them only to make your words clear, never to add requests. If a rewrite of about ten words or more repeats three or more three-word runs from that reply that you did not type, it is dropped and your prompt is sent as typed, with a toast saying so.
- Spelling, accents, grammar and punctuation are always fixed, in every prompt, short or long; code, paths, names, commands and quoted text stay as typed. When a rewrite is dropped (it repeated the conversation, came back cut short, or the API refused it), a second quick call fixes only the writing and that is sent, with a toast saying so; if that fails too, or the rewrite timed out, the prompt is sent as typed.
- Fixes never change meaning: the model first identifies what each sentence says (who does what, negation, condition, tense, quantity), then fixes only the writing, and undoes any change that would alter that meaning. A garbled draft, such as one dictated or typed fast, is read for the sentence you most likely meant and written plainly, without adding goals you did not ask for. A draft of one or two sentences stays one or two sentences; the goal, context, constraints and expected result parts are used only for long drafts. When the meaning cannot be worked out safely, your own words are kept with only the writing fixed.
- Programming words written in English (commit, branch, deploy, bug and so on) are only spell-fixed, never translated.
- When the Language in `/config` is Portuguese (`pt`, `pt-BR`, `Portuguese`, `português`), the closing line is also added by the plugin if the model forgets it, including in the spelling-only fallback. Other languages rely on the model.
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
3. Done: the `✦ Prompt Master` button appears in the prompt footer. If it does not show up, restart the Claude Code session.

**From a shell**, the same in one line. It adds the marketplace to your user settings without asking first:

```
claude plugin install prompt-master --marketplace lukeware-hub/prompt-master
```

**In the Claude desktop app**: click **+** next to the prompt box, then **Plugins**, **Add marketplace**, type `lukeware-hub/prompt-master`, then **Add plugin**.

## Privacy

Each prompt you send, and up to 2000 tokens from the end of the assistant's last reply, is sent to the fast model (haiku) through Claude Code's own model API to be rewritten. Nothing is sent to any other service. Turn rewriting off with the button or `/prompt-master` to stop it.

## Uninstall

```
/plugin uninstall prompt-master
```

## License

MIT. See [LICENSE](LICENSE).
