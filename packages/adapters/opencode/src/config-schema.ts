import { z } from 'zod'

import {
  adapterNativeCliConfigSchema,
  defineAdapterConfigContribution,
  effortLevelSchema,
  jsonValueSchema
} from '@vibe-forge/core/config-schema'

export const openCodeAdapterConfigSchema = z.object({
  cli: adapterNativeCliConfigSchema.optional().describe('Managed OpenCode CLI runtime'),
  effort: effortLevelSchema.optional().describe('Reasoning effort level'),
  agent: z.string().optional().describe('Default agent name'),
  planAgent: z.union([z.string(), z.literal(false)]).optional().describe('Plan agent override'),
  titlePrefix: z.string().optional().describe('Session title prefix'),
  share: z.boolean().optional().describe('Share sessions by default'),
  sessionListMaxCount: z.number().int().positive().optional().describe('Maximum session list count'),
  configContent: z.record(z.string(), jsonValueSchema).optional().describe('Raw OpenCode config override')
})

export type OpenCodeAdapterConfig = z.infer<typeof openCodeAdapterConfigSchema>
export type OpenCodeCommonAdapterConfigKey = 'effort'
export type OpenCodeNativeAdapterConfig = OpenCodeAdapterConfig

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'opencode',
  title: 'OpenCode',
  description: 'OpenCode adapter configuration',
  schema: openCodeAdapterConfigSchema,
  configEntry: {
    extraCommonKeys: ['effort'] as const,
    deepMergeKeys: ['cli', 'configContent'] as const
  }
})
