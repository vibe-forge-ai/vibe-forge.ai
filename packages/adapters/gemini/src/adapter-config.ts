export {}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.gemini.session': {
      geminiSessionId?: string
    }
  }

  interface AdapterMap {
    gemini: {
      disableExtensions?: boolean
      disableSubagents?: boolean
      disableAutoUpdate?: boolean
      telemetry?: 'off' | 'inherit'
      nativePromptCommands?: 'reject' | 'allow'
    }
  }
}
