import type { CopilotAdapterConfigSchema } from './config-schema'

export {}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.copilot.session': {
      copilotSessionId?: string
      title?: string
    }
  }

  interface AdapterMap {
    copilot: CopilotAdapterConfigSchema
  }
}
