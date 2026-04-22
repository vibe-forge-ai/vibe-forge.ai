import { z } from 'zod'

import { defineAdapterConfigContribution, effortLevelSchema, jsonValueSchema } from '@vibe-forge/core/config-schema'

const kimiCliConfigSchema = z.object({
  source: z.enum(['managed', 'system', 'path']).optional().describe('Kimi CLI source'),
  path: z.string().optional().describe('Kimi CLI binary path when source is path'),
  package: z.string().optional().describe('Managed uv package name'),
  version: z.string().optional().describe('Managed uv package version'),
  python: z.string().optional().describe('Python version used by uv tool install'),
  autoInstall: z.boolean().optional().describe('Install Kimi CLI when no usable binary is found'),
  prepareOnInstall: z.boolean().optional().describe('Preinstall Kimi CLI during Vibe Forge package install'),
  uvPath: z.string().optional().describe('uv binary used for managed installs')
})

export const kimiAdapterConfigSchema = z.object({
  cli: kimiCliConfigSchema.optional().describe('Managed Kimi CLI runtime'),
  agent: z.union([z.literal('default'), z.literal('okabe'), z.string()]).optional().describe('Kimi agent name'),
  thinking: z.boolean().optional().describe('Enable Kimi thinking mode'),
  showThinkingStream: z.boolean().optional().describe('Show thinking stream'),
  maxStepsPerTurn: z.number().int().positive().optional().describe('Maximum tool steps per turn'),
  maxRetriesPerStep: z.number().int().nonnegative().optional().describe('Maximum retries per tool step'),
  maxRalphIterations: z.number().int().positive().optional().describe('Maximum Ralph iterations'),
  autoInstall: z.boolean().optional().describe('Legacy shortcut for cli.autoInstall'),
  installPackage: z.string().optional().describe('Legacy shortcut for cli.package, including optional version spec'),
  installPython: z.string().optional().describe('Legacy shortcut for cli.python'),
  uvPath: z.string().optional().describe('Legacy shortcut for cli.uvPath'),
  configContent: z.record(z.string(), jsonValueSchema).optional().describe('Raw Kimi config override'),
  effort: effortLevelSchema.optional().describe('Reasoning effort level')
})

export type KimiAdapterConfig = z.infer<typeof kimiAdapterConfigSchema>
export type KimiCommonAdapterConfigKey = 'effort'
export type KimiNativeAdapterConfig = KimiAdapterConfig

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'kimi',
  title: 'Kimi',
  description: 'Kimi CLI adapter configuration',
  schema: kimiAdapterConfigSchema,
  configEntry: {
    extraCommonKeys: ['effort'] as const,
    deepMergeKeys: ['cli', 'configContent'] as const
  }
})
