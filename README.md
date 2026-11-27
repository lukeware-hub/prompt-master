# Prompt Master

Rewrites each prompt you send into a clearer, more specific and more complete one, using the Sonnet model at medium effort, before the assistant reads it.

Every rewritten prompt, short or long, follows one fixed template: `Context:` (a short summary of the draft), `Goal:` (the improved, corrected prompt) and `Observation:` (a fixed sentence asking the assistant to read the code and context first and then ask any needed question as multiple choice, with one recommended option and the reason, in simple words). It is written in the Language set in `/config` (for example `pt-BR`), with correct accents, or in your draft's language when none is set. It keeps your intent and never invents facts, files or requirements. If the rewrite fails or takes too long, your original prompt is sent as typed.

## Use

- A `✦ Prompt Master` button sits in the prompt footer. Click it to turn rewriting on or off.
- The command `/prompt-master` does the same.
- To understand short replies such as "yes" or "continue", it also reads up to 2000 tokens from the end of the assistant's last reply; it uses them only to make your words clear, never to add requests. If a rewrite of about ten words or more (not counting its closing line) repeats three or more three-word runs from that reply that you did not type, it is dropped and your prompt is sent as typed, with a toast saying so.
- Spelling, accents, grammar and punctuation are always fixed, in every prompt, short or long; code, paths, names, commands and quoted text stay as typed. When a rewrite is dropped (it repeated the conversation, came back cut short, or the API refused it), a second quick call fixes only the writing and that is sent, with a toast saying so; if that fails too, or the rewrite timed out, the prompt is sent as typed.
- Fixes never change meaning: the model first identifies what each sentence says (who does what, negation, condition, tense, quantity), then fixes only the writing, and undoes any change that would alter that meaning. A garbled draft, such as one dictated or typed fast, is read for the sentence you most likely meant and written plainly, without adding goals you did not ask for. A draft of one or two sentences gets a Goal of one or two sentences. When the meaning cannot be worked out safely, your own words are kept with only the writing fixed.
- Programming words written in English (commit, branch, deploy, bug and so on) are only spell-fixed, never translated.
- The labels `Context`, `Goal` and `Observation` are always in English, whatever the language of the prompt. The Observation sentence is the same every time; in another language the model writes it with the same meaning. An informal imperative you typed (`roda`, `faz`, `adiciona`) is kept as typed and never swapped for another verb; only a negative one changes form (`não mexe` becomes `não mexa`).
- Technical software words (`jar`, `commit`, `branch`, `hook`, `build` and so on) are kept when they fit the sentence or the last reply. One that does not fit but looks like a typing or dictation mistake of a common word (`jar pode fazer` for `Já pode fazer`) is read from the context and fixed; when the last reply itself is about that word and the sentence fits it, your word is kept as typed. Every sentence starts with a capital letter, except one that starts with code, a path, a command or a name.
- Last check: when a rewrite of a short draft lost a word or gained too many, or changed a word of code (in backticks, `file.ts`, camelCase), it is read once more against the draft and fixed, with the same model, shown as `✦ Prompt Master: checking…`. Most prompts cost one call only; if the check fails, only the writing is fixed.
- The spelling-only fix also reads the end of the last reply, only to understand which word you meant.
- When the Language in `/config` is Portuguese (`pt`, `pt-BR`, `Portuguese`, `português`, `Brazilian Portuguese`), the plugin always writes the Observation line itself (replacing the model's wording), including in the spelling-only fallback. Other languages rely on the model.
- Every prompt is rewritten, short or long; only empty prompts and the commands built into Claude Code are left as typed. This works the same in the terminal and in Claude Desktop: a prompt sent from the app is treated as yours, while scheduled, background and other-session prompts and `claude -p` runs are left as typed.
- After a skill or plugin command, such as `/impeccable`, only the text is rewritten; the command lines stay as typed.
- The rewrite's token cap and time limit grow with the prompt's length, so a long paste is rewritten whole. If the rewrite still comes back cut short, the prompt is sent as typed, with a toast saying so.
- While a prompt is being rewritten, the status line shows `✦ Prompt Master: rewriting…`.
- Your on or off choice is saved and stays the same in new sessions.

## Where the button is

- Terminal: the `✦ Prompt Master` button is in the prompt footer, at the right, next to the model.
- Claude Code Desktop: a mode bar above the prompt box holds, side by side, the toggles of Bug Fix, Prompt Master, Image Inspect and luke-voice, each one only when that mod is installed. A press on another mod's button runs that mod's own command (`/bug-fix-mode`, `/image-inspect`, `/luke-voice`), and its on or off is read from that mod. Those mods' own rows above the prompt are hidden there, and Prompt Master is not in the Desktop footer.
- Claude Desktop has other screens, **Chat** and **Cowork**, that do not run Claude Code plugins, so the plugin does not appear there. Open a session on the **Code** tab to use it.

## Install

You need Claude Code installed. Pick your app:

| App | Quick start |
| --- | --- |
| Claude Code terminal | `/plugin install prompt-master --marketplace lukeware-hub/prompt-master` |
| Claude Desktop | **Code** tab → **+** → **Plugins** → **Add marketplace** → `lukeware-hub/prompt-master` |

### Claude Code terminal

1. Open Claude Code and type at the prompt:

   ```
   /plugin install prompt-master --marketplace lukeware-hub/prompt-master
   ```

2. Answer `y` to add the marketplace.
3. Press Enter to install for your user (all your projects).
4. Done: the `✦ Prompt Master` button appears in the prompt footer. If it does not show up, restart the Claude Code session.

From a shell, the same in one line. It adds the marketplace to your user settings without asking first:

```
claude plugin install prompt-master --marketplace lukeware-hub/prompt-master
```

### Claude Desktop

1. Open the **Code** tab. **Chat** and **Cowork** do not run plugins.
2. Click **+** next to the prompt box, then **Plugins**.
3. Click **Add marketplace**, type `lukeware-hub/prompt-master`, then click **Add plugin**.
4. Done: the `✦ Prompt Master` toggle appears in the mode bar above the prompt box. If it does not show up, restart the app.

If you are in the same organization as the author, the plugin is also in your organization's library: open [this link](https://claude.ai/customize/plugins/plugin_01EaBSM5o94XnJjkhfdMdxrR) and add it from there.

### Update

- Terminal: `claude plugin update prompt-master`, then restart Claude Code.
- Desktop: restart the app after a new version is published.

## Privacy

Each prompt you send, and up to 2000 tokens from the end of the assistant's last reply, is sent to the Sonnet model (medium effort) through Claude Code's own model API to be rewritten. Nothing is sent to any other service. Turn rewriting off with the button or `/prompt-master` to stop it.

## Uninstall

```
/plugin uninstall prompt-master
```

## License

MIT. See [LICENSE](LICENSE).
