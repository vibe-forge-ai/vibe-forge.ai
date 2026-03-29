import process from 'node:process'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VIBE_FORGE_MCP_SERVER_NAME,
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
})
