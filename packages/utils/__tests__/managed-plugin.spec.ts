import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { listManagedPluginInstalls } from '#~/managed-plugin.js'

const tempDirs: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('listManagedPluginInstalls', () => {
  it('keeps valid installs when another managed plugin config is invalid', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-managed-plugin-'))
    tempDirs.push(workspace)

    await mkdir(join(workspace, '.ai/plugins/good'), { recursive: true })
    await writeFile(
      join(workspace, '.ai/plugins/good/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: 'good',
          installedAt: new Date().toISOString(),
          source: {
            type: 'path',
            path: './good'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )

    await mkdir(join(workspace, '.ai/plugins/bad'), { recursive: true })
    await writeFile(
      join(workspace, '.ai/plugins/bad/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: '',
          installedAt: new Date().toISOString(),
          source: {
            type: 'path',
            path: './bad'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const installs = await listManagedPluginInstalls(workspace)

    expect(installs.map(install => install.config.name)).toEqual(['good'])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('skips installs whose managed paths escape the install directory', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-managed-plugin-'))
    tempDirs.push(workspace)

    await mkdir(join(workspace, '.ai/plugins/escaped'), { recursive: true })
    await writeFile(
      join(workspace, '.ai/plugins/escaped/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: 'escaped',
          installedAt: new Date().toISOString(),
          source: {
            type: 'path',
            path: './escaped'
          },
          nativePluginPath: '../../outside',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const installs = await listManagedPluginInstalls(workspace)

    expect(installs).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('must stay inside the install dir')
  })

  it('accepts marketplace-backed managed plugin installs', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-managed-plugin-'))
    tempDirs.push(workspace)

    await mkdir(join(workspace, '.ai/plugins/reviewer/native'), { recursive: true })
    await mkdir(join(workspace, '.ai/plugins/reviewer/vibe-forge'), { recursive: true })
    await writeFile(
      join(workspace, '.ai/plugins/reviewer/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: 'reviewer',
          installedAt: new Date().toISOString(),
          source: {
            type: 'marketplace',
            marketplace: 'team-tools',
            plugin: 'reviewer'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )

    const installs = await listManagedPluginInstalls(workspace)

    expect(installs).toHaveLength(1)
    expect(installs[0]?.config.source).toEqual({
      type: 'marketplace',
      marketplace: 'team-tools',
      plugin: 'reviewer'
    })
  })

  it('accepts managed plugin installs for non-claude adapters', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-managed-plugin-'))
    tempDirs.push(workspace)

    await mkdir(join(workspace, '.ai/plugins/codex-helper/native'), { recursive: true })
    await mkdir(join(workspace, '.ai/plugins/codex-helper/vibe-forge'), { recursive: true })
    await writeFile(
      join(workspace, '.ai/plugins/codex-helper/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'codex',
          name: 'codex-helper',
          installedAt: new Date().toISOString(),
          source: {
            type: 'npm',
            spec: '@acme/codex-helper'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )

    const installs = await listManagedPluginInstalls(workspace, { adapter: 'codex' })

    expect(installs).toHaveLength(1)
    expect(installs[0]?.config.adapter).toBe('codex')
  })
})
