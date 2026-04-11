export {}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.claude-code.mcp': Record<string, unknown>
    'adapter.claude-code.settings': Record<string, unknown>
    'adapter.claude-code.resume-state': {
      canResume: boolean
    }
  }
  interface AdapterMap {
    'claude-code': {
      effort?: 'low' | 'medium' | 'high' | 'max'
      ccrOptions?: {
        LOG?: boolean
        PORT?: string
        HOST?: string
        APIKEY?: string
        API_TIMEOUT_MS?: number
      }
      ccrTransformers?: {
        logger?: boolean
      }
      modelFallbacks?: {
        default?: string[]
        background?: string[]
        think?: string[]
        longContext?: string[]
      }
      apiTimeout?: number
      settingsContent?: Record<string, unknown>
      nativeEnv?: Record<string, string>
      nativeModelSwitch?: boolean
      nativeModelSwitchBootstrap?: boolean
    }
  }
}
