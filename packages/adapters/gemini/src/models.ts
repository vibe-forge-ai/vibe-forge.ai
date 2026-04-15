import type { AdapterBuiltinModel } from '@vibe-forge/types'

export const builtinModels: AdapterBuiltinModel[] = [
  {
    value: 'auto',
    title: 'Auto',
    description: 'Let Gemini CLI route between the default recommended Gemini models.'
  },
  {
    value: 'auto-gemini-3',
    title: 'Auto Gemini 3',
    description: 'Let Gemini CLI choose between Gemini 3 Pro and Gemini 3 Flash.'
  },
  {
    value: 'auto-gemini-2.5',
    title: 'Auto Gemini 2.5',
    description: 'Let Gemini CLI choose between Gemini 2.5 Pro and Gemini 2.5 Flash.'
  },
  {
    value: 'gemini-3-pro-preview',
    title: 'Gemini 3 Pro Preview',
    description: 'Preview Gemini 3 Pro model for advanced coding and reasoning.'
  },
  {
    value: 'gemini-3-flash-preview',
    title: 'Gemini 3 Flash Preview',
    description: 'Preview Gemini 3 Flash model for faster everyday coding tasks.'
  },
  {
    value: 'gemini-2.5-pro',
    title: 'Gemini 2.5 Pro',
    description: 'High-capability Gemini model for complex engineering tasks.'
  },
  {
    value: 'gemini-2.5-flash',
    title: 'Gemini 2.5 Flash',
    description: 'Balanced Gemini model for general development workflows.'
  },
  {
    value: 'gemini-2.5-flash-lite',
    title: 'Gemini 2.5 Flash Lite',
    description: 'Lower-latency Gemini model for lightweight tasks.'
  }
]
