import { z } from 'zod'

import {
  adapterAccountConfigCommonSchema,
  defineAdapterConfigContribution,
  effortLevelSchema,
  jsonValueSchema
} from '@vibe-forge/core/config-schema'

const codexAdapterAccountSchema = adapterAccountConfigCommonSchema.extend({
  authFile: z.string().optional().describe('Path to the Codex auth.json file for this account')
})

export const codexAdapterConfigSchema = z.object({
  defaultAccount: z.string().optional().describe('Default Codex account key'),
  accounts: z.record(z.string(), codexAdapterAccountSchema).optional().describe('Available Codex accounts'),
  sandboxPolicy: z.object({
    type: z.enum(['readOnly', 'workspaceWrite', 'dangerFullAccess', 'externalSandbox'])
      .describe('Sandbox policy type'),
    writableRoots: z.array(z.string()).optional().describe('Additional writable roots'),
    networkAccess: z.union([
      z.boolean(),
      z.enum(['restricted', 'enabled'])
    ]).optional().describe('Network access mode')
  }).optional().describe('Sandbox policy passed to Codex'),
  experimentalApi: z.boolean().optional().describe('Enable experimental Codex API surface'),
  clientInfo: z.object({
    name: z.string().optional().describe('Client name'),
    title: z.string().optional().describe('Client title'),
    version: z.string().optional().describe('Client version')
  }).optional().describe('Client metadata reported to Codex'),
  effort: effortLevelSchema.optional().describe('Reasoning effort level'),
  configOverrides: z.record(z.string(), jsonValueSchema).optional()
    .describe('Raw Codex config overrides encoded as dotted keys'),
  maxOutputTokens: z.number().int().positive().optional().describe('Maximum output tokens per turn'),
  features: z.record(z.string(), z.boolean()).optional().describe('Codex feature flag overrides')
})

export type CodexAdapterConfig = z.infer<typeof codexAdapterConfigSchema>
export type CodexCommonAdapterConfigKey = 'effort'
export type CodexNativeAdapterConfig = CodexAdapterConfig

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'codex',
  title: 'Codex',
  description: 'Codex adapter configuration',
  schema: codexAdapterConfigSchema,
  configEntry: {
    extraCommonKeys: ['effort'] as const,
    deepMergeKeys: ['accounts', 'sandboxPolicy', 'clientInfo', 'configOverrides', 'features'] as const
  }
})
