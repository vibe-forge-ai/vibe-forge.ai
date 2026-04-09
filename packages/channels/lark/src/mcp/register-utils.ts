import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export interface RegisterServer {
  registerTool: McpServer['registerTool']
}

export const toJsonResult = (value: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(value, null, 2)
    }
  ]
})
