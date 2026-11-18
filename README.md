# Prompt Master

Rewrites each prompt you send into a clearer, more specific and more complete one, using a fast model, before the assistant reads it.

The rewritten prompt follows four parts: goal, context, constraints and expected result. It is written in the Language set in `/config` (for example `pt-BR`), with correct accents, or in your draft's language when none is set. It keeps your intent and never invents facts, files or requirements. If the rewrite fails or takes too long, your original prompt is sent as typed.

## Use

- A `✦ Prompt Master` button sits in the prompt footer. Click it to turn rewriting on or off.
- The command `/prompt-master` does the same.
- Slash commands and prompts shorter than 12 characters are never rewritten.
- Prompts longer than 4000 characters are sent as typed, so a long paste is never cut.
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
