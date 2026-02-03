import type { Writable } from 'node:stream'

import type { HookInputs, HookOutputs } from './type'

export interface HookContext {
  logger: {
    stream: Writable
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
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

export * from './type'
