import type { AdapterOptions, AdapterSession } from '@vibe-forge/core'

export function defineAdapter(fn: (options: AdapterOptions) => AdapterSession) {
  return {
    query: fn
  }
}
