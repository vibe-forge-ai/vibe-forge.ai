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
    }
  }
}
