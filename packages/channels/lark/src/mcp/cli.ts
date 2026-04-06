import { createRequire } from 'node:module'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Command } from 'commander'

import { createFilteredRegister } from './filter.js'
import { registerLarkMcpTools } from './register.js'
import { loadLarkMcpRuntimeEnv } from './types.js'

const nodeRequire = createRequire(__filename)

const getPackageJson = () => {
  try {
    return nodeRequire('@vibe-forge/channel-lark/package.json') as Record<string, unknown>
  } catch {
    return {}
  }
}

const getPackageVersion = () => {
  const version = getPackageJson().version
  return typeof version === 'string' && version.trim() !== '' ? version : '0.0.0'
}

const parseList = (value?: string) => value?.split(',').map(item => item.trim()).filter(Boolean) ?? []

const version = getPackageVersion()

const program = new Command()

program
  .name('vf-channel-lark-mcp')
  .description('Lark channel companion MCP server')
  .version(version)
  .option('--include-tools <tools>', 'Comma-separated list of tool names to enable')
  .option('--exclude-tools <tools>', 'Comma-separated list of tool names to disable')
  .action(async (options: {
    includeTools?: string
    excludeTools?: string
  }) => {
    const runtimeEnv = loadLarkMcpRuntimeEnv()
    const server = new McpServer({
      name: 'channel-lark',
      version
    })
    const proxy = createFilteredRegister(server, {
      tools: {
        include: parseList(options.includeTools),
        exclude: parseList(options.excludeTools)
      }
    })

    registerLarkMcpTools(proxy, runtimeEnv)

    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('Lark channel MCP server started on stdio')
  })

void program.parseAsync()
