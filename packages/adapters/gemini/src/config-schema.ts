import { z } from 'zod'

import { adapterNativeCliConfigSchema, defineAdapterConfigContribution } from '@vibe-forge/core/config-schema'

export const geminiAdapterConfigSchema = z.object({
  cli: adapterNativeCliConfigSchema.optional().describe('Managed Gemini CLI runtime'),
  disableExtensions: z.boolean().optional().describe('Disable Gemini extensions'),
  disableSubagents: z.boolean().optional().describe('Disable Gemini subagents'),
  disableAutoUpdate: z.boolean().optional().describe('Disable Gemini auto update checks'),
  telemetry: z.enum(['off', 'inherit']).optional().describe('Telemetry mode'),
  nativePromptCommands: z.enum(['reject', 'allow']).optional().describe('Native prompt command behavior')
})

export type GeminiAdapterConfigSchema = z.infer<typeof geminiAdapterConfigSchema>

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'gemini',
  title: 'Gemini',
  description: 'Gemini adapter configuration',
  schema: geminiAdapterConfigSchema,
  configEntry: {
    deepMergeKeys: ['cli'] as const
  }
})
