import type { AdapterBuiltinModel } from '@vibe-forge/types'

export const builtinModels: AdapterBuiltinModel[] = [
  {
    value: 'default',
    title: 'default',
    description: "Use OpenCode's configured default model"
  },
  {
    value: 'openai/gpt-5',
    title: 'openai/gpt-5',
    description: 'OpenAI GPT-5 via the OpenAI provider'
  },
  {
    value: 'anthropic/claude-sonnet-4-5',
    title: 'anthropic/claude-sonnet-4-5',
    description: 'Anthropic Claude Sonnet 4.5 via the Anthropic provider'
  },
  {
    value: 'anthropic/claude-haiku-4-5',
    title: 'anthropic/claude-haiku-4-5',
    description: 'Anthropic Claude Haiku 4.5 via the Anthropic provider'
  }
]
