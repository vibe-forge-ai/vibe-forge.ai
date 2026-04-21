import { z } from 'zod'

import { adapterNativeCliConfigSchema, defineAdapterConfigContribution } from '@vibe-forge/core/config-schema'

export const copilotAdapterConfigSchema = z.object({
  cli: adapterNativeCliConfigSchema.optional().describe('Managed GitHub Copilot CLI runtime'),
  cliPath: z.string().optional().describe('Native Copilot CLI binary path'),
  configDir: z.string().optional().describe('Copilot config directory'),
  disableWorkspaceTrust: z.boolean().optional().describe('Disable workspace trust handling'),
  logDir: z.string().optional().describe('Copilot log directory'),
  logLevel: z.enum(['none', 'error', 'warning', 'info', 'debug', 'all']).optional().describe('Copilot log level'),
  agent: z.string().optional().describe('Default agent name'),
  stream: z.boolean().optional().describe('Enable stream mode'),
  allowAll: z.boolean().optional().describe('Allow all permissions'),
  allowAllTools: z.boolean().optional().describe('Allow all tools'),
  allowAllPaths: z.boolean().optional().describe('Allow all paths'),
  allowAllUrls: z.boolean().optional().describe('Allow all URLs'),
  disableBuiltinMcps: z.boolean().optional().describe('Disable built-in MCP servers'),
  disabledMcpServers: z.array(z.string()).optional().describe('Disabled MCP server names'),
  enableAllGithubMcpTools: z.boolean().optional().describe('Enable all GitHub MCP tools'),
  additionalGithubMcpToolsets: z.array(z.string()).optional().describe('Additional GitHub MCP toolsets'),
  additionalGithubMcpTools: z.array(z.string()).optional().describe('Additional GitHub MCP tools'),
  noCustomInstructions: z.boolean().optional().describe('Disable custom instructions'),
  noAskUser: z.boolean().optional().describe('Disable AskUserQuestion')
})

export type CopilotAdapterConfigSchema = z.infer<typeof copilotAdapterConfigSchema>

export const adapterConfigContribution = defineAdapterConfigContribution({
  adapterKey: 'copilot',
  title: 'GitHub Copilot',
  description: 'GitHub Copilot adapter configuration',
  schema: copilotAdapterConfigSchema,
  configEntry: {
    deepMergeKeys: ['cli'] as const
  }
})
