import { z } from 'zod'

import { defineAdapterConfigContribution } from '@vibe-forge/core/config-schema'

export const claudeCodeAdapterConfigSchema = z.object({
  effort: z.enum(['low', 'medium', 'high', 'max']).optional().describe('Reasoning effort level'),
  ccrOptions: z.object({
    LOG: z.boolean().optional().describe('Enable CCR logging'),
    PORT: z.string().optional().describe('CCR port'),
    HOST: z.string().optional().describe('CCR host'),
    APIKEY: z.string().optional().describe('CCR API key'),
    API_TIMEOUT_MS: z.number().int().positive().optional().describe('CCR API timeout in milliseconds')
  }).optional().describe('Claude Code Router options'),
  ccrTransformers: z.object({
    logger: z.boolean().optional().describe('Enable the CCR logger transformer')
  }).optional().describe('CCR transformer flags'),
  modelFallbacks: z.object({
    default: z.array(z.string()).optional(),
    background: z.array(z.string()).optional(),
    think: z.array(z.string()).optional(),
    longContext: z.array(z.string()).optional()
  }).optional().describe('Model fallback lists'),
  apiTimeout: z.number().int().positive().optional().describe('Claude API timeout in milliseconds'),
  settingsContent: z.record(z.string(), z.unknown()).optional().describe('Raw Claude settings override'),
  nativeEnv: z.record(z.string(), z.string()).optional().describe('Native environment variables')
})

export type ClaudeCodeAdapterConfig = z.infer<typeof claudeCodeAdapterConfigSchema>
export type ClaudeCodeCommonAdapterConfigKey = 'effort'
export type ClaudeCodeNativeAdapterConfig = Omit<
  ClaudeCodeAdapterConfig,
  ClaudeCodeCommonAdapterConfigKey
>

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'claude-code',
  title: 'Claude Code',
  description: 'Claude Code adapter configuration',
  schema: claudeCodeAdapterConfigSchema,
  configEntry: {
    extraCommonKeys: ['effort'] as const,
    deepMergeKeys: [
      'ccrOptions',
      'ccrTransformers',
      'modelFallbacks',
      'settingsContent',
      'nativeEnv'
    ] as const
  }
})
