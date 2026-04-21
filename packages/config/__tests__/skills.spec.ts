import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadConfig, resetConfigCache } from '#~/load.js'

describe('skills config loading', () => {
  it('loads top-level skills arrays and skillsCli runtime config', async () => {
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
                source: 'example-source/default/public',
                rename: 'internal-review'
              }
            ],
            skillsCli: {
              source: 'managed',
              package: 'skills',
              version: 'latest',
              registry: 'https://registry.example.com',
              env: {
                SKILLS_REGION: 'cn'
              }
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

      expect(projectConfig?.skills).toEqual([
        'frontend-design',
        {
          name: 'design-review',
          source: 'example-source/default/public',
          rename: 'internal-review'
        }
      ])
      expect(projectConfig?.skillsCli).toEqual({
        source: 'managed',
        package: 'skills',
        version: 'latest',
        registry: 'https://registry.example.com',
        env: {
          SKILLS_REGION: 'cn'
        }
      })
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('keeps loading legacy skills.install and skills.cli aliases', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-skills-legacy-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            skills: {
              install: [
                'frontend-design'
              ],
              cli: {
                package: 'legacy-skills'
              }
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
      expect(projectConfig?.skillsCli).toEqual({
        package: 'legacy-skills'
      })
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })
})
