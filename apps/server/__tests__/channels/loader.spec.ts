import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const requireMock = vi.fn()

vi.mock('node:module', () => ({
  createRequire: vi.fn(() => requireMock)
}))

describe('loadChannelModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('ignores missing optional mcp exports', async () => {
    const createChannelConnection = vi.fn()

    requireMock.mockImplementation((specifier: string) => {
      if (specifier === '@vibe-forge/channel-lark') {
        return {
          channelDefinition: {
            configSchema: z.object({
              type: z.literal('lark')
            })
          }
        }
      }

      if (specifier === '@vibe-forge/channel-lark/connection') {
        return { createChannelConnection }
      }

      if (specifier === '@vibe-forge/channel-lark/mcp') {
        const error = new Error(
          'Package subpath \'./mcp\' is not defined by "exports" in /tmp/node_modules/@vibe-forge/channel-lark/package.json'
        ) as Error & { code?: string }
        error.code = 'ERR_PACKAGE_PATH_NOT_EXPORTED'
        throw error
      }

      throw new Error(`Unexpected specifier: ${specifier}`)
    })

    const { loadChannelModule } = await import('#~/channels/loader.js')
    const loaded = loadChannelModule('lark')

    expect(loaded.create).toBe(createChannelConnection)
    expect(loaded.resolveSessionMcpServers).toBeUndefined()
  })

  it('rethrows unrelated mcp loading errors', async () => {
    requireMock.mockImplementation((specifier: string) => {
      if (specifier === '@vibe-forge/channel-lark') {
        return {
          channelDefinition: {
            configSchema: z.object({
              type: z.literal('lark')
            })
          }
        }
      }

      if (specifier === '@vibe-forge/channel-lark/connection') {
        return { createChannelConnection: vi.fn() }
      }

      if (specifier === '@vibe-forge/channel-lark/mcp') {
        const error = new Error('bad export target') as Error & { code?: string }
        error.code = 'ERR_INVALID_PACKAGE_TARGET'
        throw error
      }

      throw new Error(`Unexpected specifier: ${specifier}`)
    })

    const { loadChannelModule } = await import('#~/channels/loader.js')

    expect(() => loadChannelModule('lark')).toThrow('bad export target')
  })
})
