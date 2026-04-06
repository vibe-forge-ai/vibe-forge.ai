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
    expect(resolveDefaultVibeForgeMcpServerConfig()).toEqual(expect.objectContaining({
      command: process.execPath,
      args: [expect.stringMatching(/packages\/mcp\/cli\.js$/)]
    }))
  })

  it('forwards the runtime resolution env needed by the managed MCP server', () => {
    const previousNodePath = process.env.NODE_PATH
    const previousWorkspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__
    const previousCliPackageDir = process.env.__VF_PROJECT_CLI_PACKAGE_DIR__

    process.env.NODE_PATH = '/tmp/vf-node-path'
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = '/tmp/vf-workspace'
    process.env.__VF_PROJECT_CLI_PACKAGE_DIR__ = '/tmp/vf-cli'

    try {
      expect(resolveDefaultVibeForgeMcpServerConfig()).toEqual({
        command: process.execPath,
        args: [expect.stringMatching(/packages\/mcp\/cli\.js$/)],
        env: expect.objectContaining({
          NODE_PATH: '/tmp/vf-node-path',
          __VF_PROJECT_WORKSPACE_FOLDER__: '/tmp/vf-workspace',
          __VF_PROJECT_CLI_PACKAGE_DIR__: '/tmp/vf-cli'
        })
      })
    } finally {
      if (previousNodePath == null) {
        delete process.env.NODE_PATH
      } else {
        process.env.NODE_PATH = previousNodePath
      }
      if (previousWorkspaceFolder == null) {
        delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
      } else {
        process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = previousWorkspaceFolder
      }
      if (previousCliPackageDir == null) {
        delete process.env.__VF_PROJECT_CLI_PACKAGE_DIR__
      } else {
        process.env.__VF_PROJECT_CLI_PACKAGE_DIR__ = previousCliPackageDir
      }
    }
  })
})
