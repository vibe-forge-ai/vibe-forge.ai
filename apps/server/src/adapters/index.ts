import { adapter as claudeAdapter } from './claude/index.js'
import type { AdapterOptions } from './core.js'

const adapters = {
  claude: claudeAdapter
}

export type AdapterType = keyof typeof adapters

export function query(type: AdapterType, options: AdapterOptions) {
  const adapter = adapters[type]
  if (adapter == null) {
    throw new Error(`Adapter ${type} not found`)
  }
  return adapter.query(options)
}

export * from './core.js'
