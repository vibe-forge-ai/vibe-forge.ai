import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
    delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
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

  it('loads external scoped channel packages by declared channel type', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'vf-channel-loader-'))
    const createChannelConnection = vi.fn()
    const previousWorkspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = tempDir

    try {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'channel-loader-test',
            private: true,
            dependencies: {
              '@scope/channel-external': '1.0.0'
            }
          },
          null,
          2
        )
      )

      requireMock.mockImplementation((specifier: string) => {
        if (specifier === '@vibe-forge/channel-external-channel') {
          const error = new Error(`Cannot find module '${specifier}'`) as Error & { code?: string }
          error.code = 'MODULE_NOT_FOUND'
          throw error
        }

        if (specifier === '@scope/channel-external') {
          return {
            channelDefinition: {
              type: 'external-channel',
              configSchema: z.object({
                type: z.literal('external-channel')
              })
            }
          }
        }

        if (specifier === '@scope/channel-external/connection') {
          return { createChannelConnection }
        }

        if (specifier === '@scope/channel-external/mcp') {
          const error = new Error(
            'Package subpath \'./mcp\' is not defined by "exports" in /tmp/node_modules/@scope/channel-external/package.json'
          ) as Error & { code?: string }
          error.code = 'ERR_PACKAGE_PATH_NOT_EXPORTED'
          throw error
        }

        throw new Error(`Unexpected specifier: ${specifier}`)
      })

      const { loadChannelModule } = await import('#~/channels/loader.js')
      const loaded = loadChannelModule('external-channel')

      expect(loaded.definition.type).toBe('external-channel')
      expect(loaded.create).toBe(createChannelConnection)
      expect(loaded.resolveSessionMcpServers).toBeUndefined()
    } finally {
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = previousWorkspaceFolder
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
