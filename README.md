# Prompt Master

Rewrites each prompt you send into a clearer, more specific and more complete one, using a fast model, before the assistant reads it.

The rewritten prompt follows four parts: goal, context, constraints and expected result. It keeps your language and intent and never invents facts, files or requirements. If the rewrite fails or takes too long, your original prompt is sent as typed.

## Use

- A `✦ Prompt Master` button sits in the prompt footer. Click it to turn rewriting on or off.
- The command `/prompt-master` does the same.
- Slash commands and prompts shorter than 12 characters are never rewritten.

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
