import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { describe, expect, it } from 'vitest'

import { updateConfigFile } from '#~/update.js'

describe('updateConfigFile', () => {
  it('preserves masked secret values when updating project config', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-update-'))

    try {
      const configPath = path.join(tempDir, '.ai.config.json')
      await writeFile(
        configPath,
        JSON.stringify(
          {
            modelServices: {
              openai: {
                apiKey: 'secret-key',
                baseURL: 'https://example.com'
              }
            }
          },
          null,
          2
        )
      )

      const result = await updateConfigFile({
        workspaceFolder: tempDir,
        source: 'project',
        section: 'modelServices',
        value: {
          openai: {
            apiKey: '******',
            baseURL: 'https://api.example.com'
          }
        }
      })

      expect(result.configPath).toBe(configPath)
      expect(result.updatedConfig.modelServices?.openai).toEqual({
        apiKey: 'secret-key',
        baseURL: 'https://api.example.com'
      })

      const written = JSON.parse(await readFile(configPath, 'utf-8'))
      expect(written.modelServices.openai).toEqual({
        apiKey: 'secret-key',
        baseURL: 'https://api.example.com'
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('falls back to the primary workspace dev config when the current worktree has none', async () => {
    const primaryDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-update-primary-'))
    const worktreeDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-update-worktree-'))
    const previousPrimaryWorkspace = process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__

    try {
      const primaryConfigPath = path.join(primaryDir, '.ai.dev.config.json')
      await writeFile(
        primaryConfigPath,
        JSON.stringify(
          {
            defaultModelService: 'openai',
            recommendedModels: [
              {
                service: 'openai',
                model: 'gpt-5.4'
              }
            ]
          },
          null,
          2
        )
      )

      process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = primaryDir

      const result = await updateConfigFile({
        workspaceFolder: worktreeDir,
        source: 'user',
        section: 'general',
        value: {
          defaultModelService: 'openai',
          recommendedModels: [
            {
              service: 'openai',
              model: 'gpt-5.4-mini'
            }
          ]
        }
      })

      expect(result.configPath).toBe(primaryConfigPath)
      expect(result.updatedConfig.recommendedModels).toEqual([
        {
          service: 'openai',
          model: 'gpt-5.4-mini'
        }
      ])

      const written = JSON.parse(await readFile(primaryConfigPath, 'utf-8'))
      expect(written.recommendedModels).toEqual([
        {
          service: 'openai',
          model: 'gpt-5.4-mini'
        }
      ])
    } finally {
      if (previousPrimaryWorkspace == null) {
        delete process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__
      } else {
        process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = previousPrimaryWorkspace
      }
      await rm(primaryDir, { recursive: true, force: true })
      await rm(worktreeDir, { recursive: true, force: true })
    }
  })

  it('preserves unrelated general fields when updating only permissions', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-update-'))

    try {
      const configPath = path.join(tempDir, '.ai.config.json')
      await writeFile(
        configPath,
        JSON.stringify(
          {
            announcements: ['hello'],
            shortcuts: {
              openConfig: 'mod+,'
            },
            permissions: {
              allow: ['ChromeDevtools'],
              deny: [],
              ask: ['Bash(kill:*)']
            }
          },
          null,
          2
        )
      )

      const result = await updateConfigFile({
        workspaceFolder: tempDir,
        source: 'project',
        section: 'general',
        value: {
          permissions: {
            allow: ['Bash'],
            deny: [],
            ask: []
          }
        }
      })

      expect(result.updatedConfig.announcements).toEqual(['hello'])
      expect(result.updatedConfig.shortcuts).toEqual({
        openConfig: 'mod+,'
      })
      expect(result.updatedConfig.permissions).toEqual({
        allow: ['Bash'],
        deny: [],
        ask: []
      })

      const written = JSON.parse(await readFile(configPath, 'utf-8'))
      expect(written).toEqual({
        announcements: ['hello'],
        shortcuts: {
          openConfig: 'mod+,'
        },
        permissions: {
          allow: ['Bash'],
          deny: [],
          ask: []
        }
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('writes config updates into __VF_PROJECT_CONFIG_DIR__ when provided', async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-update-workspace-'))
    const launchDir = path.join(workspaceDir, 'c', 'd', 'e')
    const previousConfigDir = process.env.__VF_PROJECT_CONFIG_DIR__
    const previousLaunchCwd = process.env.__VF_PROJECT_LAUNCH_CWD__
    const previousWorkspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__

    try {
      await mkdir(launchDir, { recursive: true })
      await writeFile(
        path.join(launchDir, '.ai.config.json'),
        JSON.stringify({
          defaultModel: 'gpt-5.4'
        }, null, 2)
      )

      process.env.__VF_PROJECT_LAUNCH_CWD__ = launchDir
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = '../../..'
      process.env.__VF_PROJECT_CONFIG_DIR__ = '.'

      const result = await updateConfigFile({
        workspaceFolder: launchDir,
        source: 'project',
        section: 'general',
        value: {
          defaultModel: 'gpt-5.4-mini'
        }
      })

      expect(result.configPath).toBe(path.join(launchDir, '.ai.config.json'))
      const written = JSON.parse(await readFile(result.configPath, 'utf-8'))
      expect(written.defaultModel).toBe('gpt-5.4-mini')
    } finally {
      if (previousConfigDir == null) {
        delete process.env.__VF_PROJECT_CONFIG_DIR__
      } else {
        process.env.__VF_PROJECT_CONFIG_DIR__ = previousConfigDir
      }
      if (previousLaunchCwd == null) {
        delete process.env.__VF_PROJECT_LAUNCH_CWD__
      } else {
        process.env.__VF_PROJECT_LAUNCH_CWD__ = previousLaunchCwd
      }
      if (previousWorkspaceFolder == null) {
        delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
      } else {
        process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = previousWorkspaceFolder
      }
      await rm(workspaceDir, { recursive: true, force: true })
    }
  })
})
