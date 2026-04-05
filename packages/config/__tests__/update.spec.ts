import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
})
