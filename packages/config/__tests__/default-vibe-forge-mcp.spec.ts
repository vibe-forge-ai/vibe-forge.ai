import process from 'node:process'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VIBE_FORGE_MCP_PERMISSION_NAME,
  DEFAULT_VIBE_FORGE_MCP_SERVER_NAME,
  mergeDefaultVibeForgeMcpPermissions,
  resolveDefaultVibeForgeMcpServerConfig,
  resolveUseDefaultVibeForgeMcpServer
} from '#~/default-vibe-forge-mcp.js'

describe('default Vibe Forge MCP', () => {
  it('enables the built-in MCP server by default', () => {
    expect(resolveUseDefaultVibeForgeMcpServer({})).toBe(true)
  })

  it('lets config disable the built-in MCP server unless runtime overrides it', () => {
    expect(resolveUseDefaultVibeForgeMcpServer({
      projectConfig: {
        noDefaultVibeForgeMcpServer: true
      }
    })).toBe(false)

    expect(resolveUseDefaultVibeForgeMcpServer({
      projectConfig: {
        noDefaultVibeForgeMcpServer: true
      },
      runtimeValue: true
    })).toBe(true)
  })

  it('resolves the managed MCP CLI wrapper as a stdio server command', () => {
    expect(DEFAULT_VIBE_FORGE_MCP_SERVER_NAME).toBe('vibe-forge')
    expect(resolveDefaultVibeForgeMcpServerConfig()).toEqual({
      command: process.execPath,
      args: [expect.stringMatching(/packages\/mcp\/cli\.js$/)]
    })
  })

  it('adds the default managed permission alongside the built-in MCP server', () => {
    const [projectConfig, userConfig] = mergeDefaultVibeForgeMcpPermissions({
      projectConfig: {
        permissions: {
          allow: ['Read']
        }
      }
    })

    expect(DEFAULT_VIBE_FORGE_MCP_PERMISSION_NAME).toBe('vibe-forge')
    expect(projectConfig?.permissions?.allow).toEqual(['Read', 'vibe-forge'])
    expect(userConfig).toBeUndefined()
  })

  it('does not add the default managed permission when the built-in MCP server is disabled', () => {
    const [projectConfig] = mergeDefaultVibeForgeMcpPermissions({
      projectConfig: {
        noDefaultVibeForgeMcpServer: true,
        permissions: {
          allow: ['Read']
        }
      }
    })

    expect(projectConfig?.permissions?.allow).toEqual(['Read'])
  })
})
