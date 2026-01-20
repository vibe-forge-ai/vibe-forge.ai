import type { AdapterOptions, AdapterOutputEvent, AdapterSession } from '@vibe-forge/core'

export type { AdapterOptions, AdapterOutputEvent, AdapterSession }

export function defineAdapter(fn: (options: AdapterOptions) => AdapterSession) {
  return {
    query: fn
  }
}
