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
      agent?: string
      planAgent?: string | false
      titlePrefix?: string
      share?: boolean
      sessionListMaxCount?: number
      configContent?: Record<string, unknown>
    }
  }
}
