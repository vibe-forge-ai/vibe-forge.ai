import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { resetConfigCache } from '@vibe-forge/config'

import { resolveManagedPluginSource } from '#~/commands/@core/plugin-source.js'
import { resolvePluginCommandAdapter } from '#~/commands/plugin.js'

const tempDirs: string[] = []

afterEach(async () => {
  resetConfigCache()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('plugin command helpers', () => {
  it('uses merged config defaultAdapter when --adapter is omitted', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'vf-plugin-command-'))
    tempDirs.push(cwd)

    await writeFile(
      path.join(cwd, '.ai.config.yaml'),
      [
        'defaultAdapter: codex'
      ].join('\n')
    )

    await expect(resolvePluginCommandAdapter(undefined, cwd)).resolves.toBe('codex')
    await expect(resolvePluginCommandAdapter('claude', cwd)).resolves.toBe('claude')
  })

  it('supports explicit npm: specs for ambiguous unscoped package sources', async () => {
    await expect(resolveManagedPluginSource(process.cwd(), 'npm:reviewer@team-tools')).resolves.toEqual({
      type: 'npm',
      spec: 'reviewer@team-tools'
    })
  })
})
