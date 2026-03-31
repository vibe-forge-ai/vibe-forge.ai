import type { HookPluginConfig } from '@vibe-forge/types'
import type { Logger } from '@vibe-forge/utils/create-logger'

import type { HookInputs, HookOutputs } from './type'

export type HookLogger = Logger

export interface HookContext {
  logger: HookLogger
}

export type Plugin =
  & {
    name?: string
  }
  & {
    [P in keyof HookInputs]: (
      ctx: HookContext,
      input: HookInputs[P],
      next: () => Promise<HookOutputs[P]>
    ) => Promise<HookOutputs[P]>
  }

export const definePlugin = (plugin: Partial<Plugin>) => plugin

export type PluginConfig =
  | (Partial<Plugin> | (() => Partial<Plugin>))[]
  | HookPluginConfig
