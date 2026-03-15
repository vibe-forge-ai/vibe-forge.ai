export {}

declare module '@vibe-forge/core' {
  interface Cache {
    'adapter.claude-code.mcp': Record<string, unknown>
    'adapter.claude-code.settings': Record<string, unknown>
  }
  interface AdapterMap {
    'claude-code': {
      ccrOptions?: {
        LOG?: boolean
        PORT?: string
        HOST?: string
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
