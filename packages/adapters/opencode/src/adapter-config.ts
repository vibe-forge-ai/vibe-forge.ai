import type { OpenCodeAdapterConfig } from './config-schema.js'

export {}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.opencode.session': {
      opencodeSessionId?: string
      title?: string
    }
  }
  interface AdapterMap {
    opencode: OpenCodeAdapterConfig
  }
}
