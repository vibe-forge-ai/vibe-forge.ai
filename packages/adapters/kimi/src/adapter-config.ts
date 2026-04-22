import type { KimiAdapterConfig } from './config-schema.js'

export {}

declare module '@vibe-forge/types' {
  interface AdapterMap {
    kimi: KimiAdapterConfig
  }
}
