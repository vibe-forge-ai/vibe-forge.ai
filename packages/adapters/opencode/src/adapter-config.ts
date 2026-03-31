export {}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.opencode.session': {
      opencodeSessionId?: string
      title?: string
    }
  }
  interface AdapterMap {
    opencode: {
      effort?: 'low' | 'medium' | 'high' | 'max'
      agent?: string
      planAgent?: string | false
      titlePrefix?: string
      share?: boolean
      sessionListMaxCount?: number
      configContent?: Record<string, unknown>
    }
  }
}
