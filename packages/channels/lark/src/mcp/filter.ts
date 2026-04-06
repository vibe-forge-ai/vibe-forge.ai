import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegisterServer } from './register-utils.js'

const shouldEnable = (
  name: string,
  filter?: {
    include?: string[]
    exclude?: string[]
  }
) => {
  const include = filter?.include ?? []
  const exclude = filter?.exclude ?? []
  if (include.length > 0 && !include.includes(name)) return false
  if (exclude.includes(name)) return false
  return true
}

export const createFilteredRegister = (
  server: McpServer,
  options?: {
    tools?: {
      include?: string[]
      exclude?: string[]
    }
  }
): RegisterServer => {
  const registerTool: RegisterServer['registerTool'] = (name, config, cb) => {
    const tool = server.registerTool(name, config, cb)
    if (!shouldEnable(name, options?.tools)) {
      tool.disable()
    }
    return tool
  }
  return { registerTool }
}
