import type { PluginConfig } from '@vibe-forge/types'

export interface RunTaskOptions {
  ctxId?: string
  adapter?: string
  env?: Record<string, string | undefined | null>
  cwd?: string
  plugins?: PluginConfig
}
