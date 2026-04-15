import type { AdapterBuiltinModel } from '@vibe-forge/types'

export const builtinModels: AdapterBuiltinModel[] = [
  {
    value: 'default',
    title: 'default',
    description: "Use GitHub Copilot CLI's configured default model"
  },
  {
    value: 'claude-sonnet-4.5',
    title: 'Claude Sonnet 4.5',
    description: 'Default Copilot CLI model for coding tasks'
  },
  {
    value: 'gpt-5',
    title: 'GPT-5',
    description: 'OpenAI GPT-5 via GitHub Copilot'
  },
  {
    value: 'gpt-5.1',
    title: 'GPT-5.1',
    description: 'OpenAI GPT-5.1 via GitHub Copilot'
  },
  {
    value: 'gpt-5.2',
    title: 'GPT-5.2',
    description: 'OpenAI GPT-5.2 via GitHub Copilot'
  }
]
