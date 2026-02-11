import process from 'node:process'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { Command } from 'commander'

import { getCliVersion } from '#~/utils.js'

import * as mcpTools from '../mcp-tools'
import { createFilteredRegister, shouldEnableCategory } from '../mcp-tools/proxy'

interface McpOptions {
  includeTools?: string
  excludeTools?: string
  includePrompts?: string
  excludePrompts?: string
  includeResources?: string
  excludeResources?: string
  includeCategory?: string
  excludeCategory?: string
}

export function registerMcpCommand(program: Command) {
  program
    .command('mcp')
    .description('Start MCP server (stdio)')
    .option('--include-tools <tools>', 'Comma-separated list of tools to include')
    .option('--exclude-tools <tools>', 'Comma-separated list of tools to exclude')
    .option('--include-prompts <prompts>', 'Comma-separated list of prompts to include')
    .option('--exclude-prompts <prompts>', 'Comma-separated list of prompts to exclude')
    .option('--include-resources <resources>', 'Comma-separated list of resources to include')
    .option('--exclude-resources <resources>', 'Comma-separated list of resources to exclude')
    .option('--include-category <categories>', 'Comma-separated list of categories to include')
    .option('--exclude-category <categories>', 'Comma-separated list of categories to exclude')
    .action(async (opts: McpOptions) => {
      const parseList = (s?: string) => s?.split(',').map((t) => t.trim()).filter(Boolean) ?? []

      const server = new McpServer({
        name: 'vibe-forge',
        version: getCliVersion()
      })

      const proxyServer = createFilteredRegister(server, {
        tools: { include: parseList(opts.includeTools), exclude: parseList(opts.excludeTools) },
        prompts: { include: parseList(opts.includePrompts), exclude: parseList(opts.excludePrompts) },
        resources: { include: parseList(opts.includeResources), exclude: parseList(opts.excludeResources) }
      })

      const categoryFilter = {
        include: parseList(opts.includeCategory),
        exclude: parseList(opts.excludeCategory)
      }

      const runType = process.env.__VF_PROJECT_AI_RUN_TYPE__ ?? 'cli'

      Object.entries(mcpTools.tools).forEach(([category, register]) => {
        if (category === 'interaction' && runType !== 'server') {
          return
        }

        if (shouldEnableCategory(category, categoryFilter)) {
          register(proxyServer)
        }
      })

      const transport = new StdioServerTransport()
      await server.connect(transport)

      console.error('MCP server started on stdio')
    })
}
