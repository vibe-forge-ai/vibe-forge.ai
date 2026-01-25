import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export interface Register {
  (
    server: {
      registerTool: McpServer['registerTool']
      registerResource: McpServer['registerResource']
      registerPrompt: McpServer['registerPrompt']
    }
  ): void
}

export const defineRegister = (register: Register) => register
