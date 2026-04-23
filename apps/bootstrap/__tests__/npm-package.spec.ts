import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolvePackageManagerEnv } from '../src/npm-package'

describe('bootstrap npm package env', () => {
  const originalCwd = process.cwd()
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-bootstrap-npm-'))
    process.chdir(tempDir)
    vi.stubEnv('NPM_CONFIG_USERCONFIG', undefined)
    vi.stubEnv('npm_config_userconfig', undefined)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    vi.unstubAllEnvs()
    await rm(tempDir, { force: true, recursive: true })
  })

  it('uses the project npmrc as npm userconfig', async () => {
    const projectNpmrc = path.join(process.cwd(), '.npmrc')
    await writeFile(projectNpmrc, '@vibe-forge:registry=https://registry.npmjs.org/\n')

    const env = resolvePackageManagerEnv()

    expect(env.NPM_CONFIG_USERCONFIG).toBe(projectNpmrc)
    expect(env.npm_config_userconfig).toBe(projectNpmrc)
  })

  it('keeps an explicit npm userconfig override', async () => {
    const explicitUserConfig = path.join(tempDir, 'custom.npmrc')
    await writeFile(path.join(tempDir, '.npmrc'), '@vibe-forge:registry=https://registry.npmjs.org/\n')
    vi.stubEnv('NPM_CONFIG_USERCONFIG', explicitUserConfig)

    const env = resolvePackageManagerEnv()

    expect(env.NPM_CONFIG_USERCONFIG).toBe(explicitUserConfig)
    expect(env.npm_config_userconfig).toBe(explicitUserConfig)
  })
})
