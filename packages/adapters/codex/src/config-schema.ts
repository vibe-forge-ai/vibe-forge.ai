import { z } from 'zod'

import { defineAdapterConfigContribution, jsonValueSchema } from '@vibe-forge/core/config-schema'

export const codexAdapterConfigSchema = z.object({
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
  effort: z.enum(['low', 'medium', 'high', 'max']).optional().describe('Reasoning effort level'),
  configOverrides: z.record(z.string(), jsonValueSchema).optional()
    .describe('Raw Codex config overrides encoded as dotted keys'),
  maxOutputTokens: z.number().int().positive().optional().describe('Maximum output tokens per turn'),
  features: z.record(z.string(), z.boolean()).optional().describe('Codex feature flag overrides')
})

export type CodexAdapterConfig = z.infer<typeof codexAdapterConfigSchema>

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'codex',
  title: 'Codex',
  description: 'Codex adapter configuration',
  schema: codexAdapterConfigSchema
})
