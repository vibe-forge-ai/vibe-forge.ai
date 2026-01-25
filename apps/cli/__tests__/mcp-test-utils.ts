import type { Register } from '#~/mcp-tools/types'
import type { z } from 'zod'

type ToolHandler = (args: any) => Promise<any>

interface ToolEntry {
  handler: ToolHandler
  schema: z.ZodType<any>
  title: string
  description?: string
}

/**
 * Creates a tool tester that can register and call tools, simulating the MCP server environment.
 */
export function createToolTester() {
  const tools = new Map<string, ToolEntry>()

  const mockRegister: Parameters<Register>[0] = {
    registerTool: (name, options, handler) => {
      tools.set(name, {
        // @ts-ignore - The handler type from the SDK is complex with extra context
        handler: handler as ToolHandler,
        schema: options.inputSchema as z.ZodType<any>,
        title: options.title,
        description: options.description
      })
      return {
        disable: () => {
          // In a real server this would disable the tool
        }
      } as any
    },
    registerPrompt: () => {
      return {
        disable: () => {}
      } as any
    },
    registerResource: () => {
      return {
        disable: () => {}
      } as any
    }
  }

  return {
    mockRegister,
    /**
     * Calls a registered tool with the given arguments.
     * Performs Zod validation before calling the handler.
     */
    async callTool(name: string, args: unknown) {
      const tool = tools.get(name)
      if (!tool) {
        throw new Error(`Tool "${name}" not found. Registered tools: ${Array.from(tools.keys()).join(', ')}`)
      }

      // Simulate Zod validation that McpServer would do
      const validatedArgs = tool.schema.parse(args)
      return tool.handler(validatedArgs)
    },
    /**
     * Gets information about a registered tool.
     */
    getToolInfo(name: string) {
      return tools.get(name)
    },
    /**
     * Returns a list of all registered tool names.
     */
    getRegisteredTools() {
      return Array.from(tools.keys())
    }
  }
}
