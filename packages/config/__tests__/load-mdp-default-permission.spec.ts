import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { loadConfig, resetConfigCache } from '#~/load.js'

describe('loadConfig default MDP permissions', () => {
  it('injects the built-in MDP listPaths permission when the default bridge is enabled', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-default-mdp-permission-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            permissions: {
              allow: ['Read']
            }
          },
          null,
          2
        )
      )

      resetConfigCache()
      const [projectConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig?.permissions?.allow).toEqual(['Read', 'VibeForge', 'mcp-mdp-listpaths'])
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('does not inject the built-in MDP listPaths permission when the default bridge is disabled', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-disable-default-mdp-permission-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            mdp: {
              noDefaultBridge: true
            },
            permissions: {
              allow: ['Read']
            },
            noDefaultVibeForgeMcpServer: true
          },
          null,
          2
        )
      )

      resetConfigCache()
      const [projectConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig?.permissions?.allow).toEqual(['Read'])
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })
})
