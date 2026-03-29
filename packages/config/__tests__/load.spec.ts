import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { describe, expect, it } from 'vitest'

import { loadConfig, resetConfigCache } from '#~/load.js'

const DISABLE_DEV_CONFIG_ENV = '__VF_PROJECT_AI_DISABLE_DEV_CONFIG__'

describe('loadConfig', () => {
  it('can skip workspace dev config via env override', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-load-'))
    const previousCwd = process.cwd()
    const previousDisableDevConfig = process.env[DISABLE_DEV_CONFIG_ENV]

    try {
      await writeFile(path.join(tempDir, '.ai.config.json'), JSON.stringify({
        defaultModel: 'project-model'
      }))
      await writeFile(path.join(tempDir, '.ai.dev.config.json'), JSON.stringify({
        defaultModel: 'dev-model'
      }))

      process.chdir(tempDir)
      process.env[DISABLE_DEV_CONFIG_ENV] = '1'
      resetConfigCache()

      const [projectConfig, userConfig] = await loadConfig({
        jsonVariables: {}
      })

      expect(projectConfig?.defaultModel).toBe('project-model')
      expect(userConfig).toBeUndefined()
    } finally {
      process.chdir(previousCwd)
      if (previousDisableDevConfig == null) {
        delete process.env[DISABLE_DEV_CONFIG_ENV]
      } else {
        process.env[DISABLE_DEV_CONFIG_ENV] = previousDisableDevConfig
      }
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })
})
