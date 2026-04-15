import type { AdapterBuiltinModel } from '@vibe-forge/types'

export const builtinModels: AdapterBuiltinModel[] = [
  {
    value: 'default',
    title: 'default',
    description: "Use Kimi CLI's configured default model"
  },
  {
    value: 'kimi-for-coding',
    title: 'kimi-for-coding',
    description: 'Official Kimi Code coding model from the upstream configuration examples'
  },
  {
    value: 'kimi-k2-thinking-turbo',
    title: 'kimi-k2-thinking-turbo',
    description: 'Kimi K2 thinking-capable model from the upstream configuration examples'
  }
]
