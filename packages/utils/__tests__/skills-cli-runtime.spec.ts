import { describe, expect, it } from 'vitest'

import { resolveSkillsCliCommand } from '#~/skills-cli.js'

describe('skills CLI runtime', () => {
  it('uses npm exec for managed runtimes instead of prefix installs', async () => {
    const resolved = await resolveSkillsCliCommand({
      cwd: '/tmp/workspace',
      registry: 'https://registry.example.com'
    })

    expect(resolved.command).toBe('npm')
    expect(resolved.prefixArgs).toEqual([
      'exec',
      '--yes',
      '--package',
      'skills@latest',
      '--',
      'skills'
    ])
    expect(resolved.env).toMatchObject({
      npm_config_registry: 'https://registry.example.com'
    })
    expect(String((resolved.env as Record<string, string | undefined>).npm_config_cache))
      .toContain('/adapter-skills_cli/cli/npm/.npm-cache')
  })

  it('keeps explicit path sources as direct skill binary invocations', async () => {
    const resolved = await resolveSkillsCliCommand({
      cwd: '/tmp/workspace',
      config: {
        source: 'path',
        path: '/opt/bin/skills'
      }
    })

    expect(resolved.command).toBe('/opt/bin/skills')
    expect(resolved.prefixArgs).toEqual([])
  })
})
