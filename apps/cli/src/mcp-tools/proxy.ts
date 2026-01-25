import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { Register } from './types.js'

export interface FilterOptions {
  include?: string[]
  exclude?: string[]
}

export function createFilteredRegister(
  server: McpServer,
  options: {
    tools?: FilterOptions
    prompts?: FilterOptions
    resources?: FilterOptions
  }
): Parameters<Register>[0] {
  const shouldEnable = (name: string, filter?: FilterOptions) => {
    if (!filter) return true
    const { include = [], exclude = [] } = filter
    if (include.length > 0 && !include.includes(name)) return false
    if (exclude.includes(name)) return false
    return true
  }

  return {
    registerTool: (...args) => {
      const tool = server.registerTool(...args)
      const name = args[0]
      if (!shouldEnable(name, options.tools)) {
        tool.disable()
      }
      return tool
    },
    registerPrompt: (...args) => {
      const prompt = server.registerPrompt(...args)
      const name = args[0]
      if (!shouldEnable(name, options.prompts)) {
        prompt.disable()
      }
      return prompt
    },
    registerResource: (...args) => {
      // @ts-ignore - McpServer types have complex overloads that are hard to proxy perfectly
      const resource = server.registerResource(...args)
      const name = args[0]
      if (!shouldEnable(name, options.resources)) {
        resource.disable()
      }
      return resource
    }
  }
}

export const shouldEnableCategory = (
  category: string,
  options: FilterOptions
) => {
  const { include = [], exclude = [] } = options
  if (include.length > 0 && !include.includes(category)) return false
  if (exclude.includes(category)) return false
  return true
}
