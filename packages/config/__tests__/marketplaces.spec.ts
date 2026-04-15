import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { loadConfig, resetConfigCache } from '#~/load.js'

describe('marketplace config loading', () => {
  it('loads declared marketplace plugins and syncOnRun config', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-marketplace-plugins-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.yaml'),
        [
          'marketplaces:',
          '  team-tools:',
          '    type: claude-code',
          '    syncOnRun: true',
          '    plugins:',
          '      reviewer:',
          '        scope: review',
          '      chrome: false',
          '    options:',
          '      source:',
          '        source: settings',
          '        plugins:',
          '          - name: reviewer',
          '            source:',
          '              source: npm',
          '              package: "@acme/reviewer"'
        ].join('\n')
      )

      resetConfigCache()
      const [projectConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig?.marketplaces).toEqual({
        'team-tools': {
          type: 'claude-code',
          syncOnRun: true,
          plugins: {
            reviewer: {
              scope: 'review'
            },
            chrome: {
              enabled: false
            }
          },
          options: {
            source: {
              source: 'settings',
              plugins: [
                {
                  name: 'reviewer',
                  source: {
                    source: 'npm',
                    package: '@acme/reviewer'
                  }
                }
              ]
            }
          }
        }
      })
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('rejects inline Claude settings marketplaces that use relative plugin sources', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-marketplace-settings-'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.yaml'),
        [
          'marketplaces:',
          '  team-tools:',
          '    type: claude-code',
          '    options:',
          '      source:',
          '        source: settings',
          '        plugins:',
          '          - name: reviewer',
          '            source: reviewer'
        ].join('\n')
      )

      resetConfigCache()
      const [projectConfig, userConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig).toBeUndefined()
      expect(userConfig).toBeUndefined()
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'Inline Claude settings marketplaces must use an explicit source object'
      ))
    } finally {
      errorSpy.mockRestore()
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })
})
