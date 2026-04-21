import type { CodexAdapterConfig } from './config-schema.js'

export {}

declare module '@vibe-forge/types' {
  interface AdapterMap {
    'codex': CodexAdapterConfig
  }
}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.codex.threads': Record<string, string>
  }
}
