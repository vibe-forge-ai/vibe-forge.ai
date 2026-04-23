import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadConfig, resetConfigCache } from '#~/load.js'

describe('skills config loading', () => {
  it('loads top-level skills arrays with embedded registry and version metadata', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-skills-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            skills: [
              'frontend-design',
              {
                name: 'design-review',
                registry: 'https://registry.example.com',
                source: 'example-source/default/public',
                version: '1.0.3',
                rename: 'internal-review'
              }
            ]
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

      expect(projectConfig?.skills).toEqual([
        'frontend-design',
        {
          name: 'design-review',
          registry: 'https://registry.example.com',
          source: 'example-source/default/public',
          version: '1.0.3',
          rename: 'internal-review'
        }
      ])
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('keeps loading legacy skills.install aliases', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-skills-legacy-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            skills: {
              install: [
                'frontend-design'
              ]
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

      expect(projectConfig?.skills).toEqual(['frontend-design'])
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })
})
