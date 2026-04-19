import type { ClaudeCodeAdapterConfig } from './config-schema.js'

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
    'claude-code': ClaudeCodeAdapterConfig
  }
}
