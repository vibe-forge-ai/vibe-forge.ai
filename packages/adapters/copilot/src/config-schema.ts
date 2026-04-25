import { z } from 'zod'

import {
  adapterNativeCliConfigSchema,
  defineAdapterConfigContribution,
  effortLevelSchema,
  jsonValueSchema
} from '@vibe-forge/core/config-schema'

export const copilotAdapterConfigSchema = z.object({
  cli: adapterNativeCliConfigSchema.optional().describe('Managed GitHub Copilot CLI runtime'),
  effort: effortLevelSchema.optional().describe('Reasoning effort level'),
  cliPath: z.string().optional().describe('Native Copilot CLI binary path'),
  configDir: z.string().optional().describe('Copilot config directory'),
  configContent: z.record(z.string(), jsonValueSchema).optional().describe('Raw Copilot settings override'),
  disableWorkspaceTrust: z.boolean().optional().describe('Disable workspace trust handling'),
  logDir: z.string().optional().describe('Copilot log directory'),
  logLevel: z.enum(['none', 'error', 'warning', 'info', 'debug', 'all']).optional().describe('Copilot log level'),
  agent: z.string().optional().describe('Default agent name'),
  agentDirs: z.array(z.string()).optional().describe('Additional Copilot custom agent directories'),
  pluginDirs: z.array(z.string()).optional().describe('Local Copilot plugin directories'),
  additionalInstructions: z.string().optional().describe('Additional custom instructions'),
  stream: z.boolean().optional().describe('Enable stream mode'),
  remote: z.boolean().optional().describe('Enable Copilot remote sessions'),
  allowAll: z.boolean().optional().describe('Allow all permissions'),
  allowAllTools: z.boolean().optional().describe('Allow all tools'),
  allowAllPaths: z.boolean().optional().describe('Allow all paths'),
  allowAllUrls: z.boolean().optional().describe('Allow all URLs'),
  allowTools: z.array(z.string()).optional().describe('Allowed Copilot tool permission patterns'),
  denyTools: z.array(z.string()).optional().describe('Denied Copilot tool permission patterns'),
  allowUrls: z.array(z.string()).optional().describe('Allowed URL patterns'),
  denyUrls: z.array(z.string()).optional().describe('Denied URL patterns'),
  additionalDirs: z.array(z.string()).optional().describe('Additional directories allowed for file access'),
  disableBuiltinMcps: z.boolean().optional().describe('Disable built-in MCP servers'),
  disabledMcpServers: z.array(z.string()).optional().describe('Disabled MCP server names'),
  enableAllGithubMcpTools: z.boolean().optional().describe('Enable all GitHub MCP tools'),
  additionalGithubMcpToolsets: z.array(z.string()).optional().describe('Additional GitHub MCP toolsets'),
  additionalGithubMcpTools: z.array(z.string()).optional().describe('Additional GitHub MCP tools'),
  noCustomInstructions: z.boolean().optional().describe('Disable custom instructions'),
  noAskUser: z.boolean().optional().describe('Disable AskUserQuestion'),
  mode: z.string().optional().describe('Initial Copilot agent mode'),
  autopilot: z.boolean().optional().describe('Enable Copilot autopilot continuation'),
  maxAutopilotContinues: z.number().int().positive().optional().describe('Maximum autopilot continuations'),
  noColor: z.boolean().optional().describe('Disable color output'),
  noBanner: z.boolean().optional().describe('Disable startup banner'),
  debug: z.boolean().optional().describe('Enable Copilot debug output'),
  experimental: z.boolean().optional().describe('Enable Copilot experimental features'),
  enableReasoningSummaries: z.boolean().optional().describe('Request reasoning summaries')
})

export type CopilotAdapterConfigSchema = z.infer<typeof copilotAdapterConfigSchema>

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'copilot',
  title: 'GitHub Copilot',
  description: 'GitHub Copilot adapter configuration',
  schema: copilotAdapterConfigSchema,
  configEntry: {
    extraCommonKeys: ['effort'] as const,
    deepMergeKeys: ['cli', 'configContent'] as const
  }
})
