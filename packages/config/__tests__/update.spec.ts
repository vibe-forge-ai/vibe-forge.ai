import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { updateConfigFile } from '#~/update.js'

describe('updateConfigFile', () => {
  it('preserves masked secret values when updating project config', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-update-'))

    try {
      const configPath = path.join(tempDir, '.ai.config.json')
      await writeFile(configPath, JSON.stringify({
        modelServices: {
          openai: {
            apiKey: 'secret-key',
            baseURL: 'https://example.com'
          }
        }
      }, null, 2))

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
})
