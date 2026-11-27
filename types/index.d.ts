declare module 'claude-code' {
  interface PluginState {
    'prompt-master': { isOn: boolean }
    // The other modes the desktop mode bar reads (each mod owns and writes its own value).
    'bug-fix-mode': { isOn: boolean }
    'image-inspect': { isOn: boolean }
    'luke-voice': { isOn: boolean }
  }
}
