import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolvePackageManagerEnv, resolvePublishedPackageVersion } from '../src/npm-package'

describe('bootstrap npm package env', () => {
  const originalCwd = process.cwd()
  const originalPath = process.env.PATH
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-bootstrap-npm-'))
    process.chdir(tempDir)
    vi.restoreAllMocks()
    vi.stubEnv('__VF_PROJECT_REAL_HOME__', tempDir)
    vi.stubEnv('VF_BOOTSTRAP_DISABLE_BACKGROUND_REFRESH', '1')
    vi.stubEnv('VF_BOOTSTRAP_PACKAGE_LOOKUP_TIMEOUT_MS', '1000')
    vi.stubEnv('NPM_CONFIG_USERCONFIG', undefined)
    vi.stubEnv('npm_config_userconfig', undefined)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await rm(tempDir, { force: true, recursive: true })
  })

  const installFakeNpm = async () => {
    const binDir = path.join(tempDir, 'bin')
    const npmBin = path.join(binDir, 'npm')
    await mkdir(binDir, { recursive: true })
    await writeFile(
      npmBin,
      `#!/usr/bin/env node
const delay = Number.parseInt(process.env.VF_TEST_NPM_VIEW_DELAY_MS || '0', 10)
const version = process.env.VF_TEST_NPM_VIEW_VERSION || '1.0.0'
if (process.argv[2] === 'view') {
  setTimeout(() => {
    process.stdout.write(JSON.stringify(version) + '\\n')
  }, delay)
} else {
  process.exit(1)
}
`,
      'utf8'
    )
    await chmod(npmBin, 0o755)
    vi.stubEnv('PATH', [binDir, originalPath].filter(Boolean).join(path.delimiter))
  }

  it('uses the project npmrc as npm userconfig', async () => {
    const projectNpmrc = path.join(process.cwd(), '.npmrc')
    await writeFile(projectNpmrc, '@vibe-forge:registry=https://registry.npmjs.org/\n')

    const env = resolvePackageManagerEnv()

    expect(env.NPM_CONFIG_USERCONFIG).toBe(projectNpmrc)
    expect(env.npm_config_userconfig).toBe(projectNpmrc)
    expect(env.NPM_CONFIG_REPLACE_REGISTRY_HOST).toBe('never')
    expect(env.npm_config_replace_registry_host).toBe('never')
  })

  it('keeps an explicit npm userconfig override', async () => {
    const explicitUserConfig = path.join(tempDir, 'custom.npmrc')
    await writeFile(path.join(tempDir, '.npmrc'), '@vibe-forge:registry=https://registry.npmjs.org/\n')
    vi.stubEnv('NPM_CONFIG_USERCONFIG', explicitUserConfig)

    const env = resolvePackageManagerEnv()

    expect(env.NPM_CONFIG_USERCONFIG).toBe(explicitUserConfig)
    expect(env.npm_config_userconfig).toBe(explicitUserConfig)
  })

  it('records fast npm view results for later launches', async () => {
    await installFakeNpm()
    vi.stubEnv('VF_TEST_NPM_VIEW_VERSION', '1.2.3')

    await expect(resolvePublishedPackageVersion('@scope/pkg')).resolves.toBe('1.2.3')

    vi.stubEnv('VF_TEST_NPM_VIEW_VERSION', '2.0.0')
    await expect(resolvePublishedPackageVersion('@scope/pkg')).resolves.toBe('2.0.0')
  })

  it('uses cached package versions when npm view exceeds the startup budget', async () => {
    await installFakeNpm()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('VF_BOOTSTRAP_PACKAGE_LOOKUP_TIMEOUT_MS', '20')
    vi.stubEnv('VF_TEST_NPM_VIEW_VERSION', '1.2.3')

    await expect(resolvePublishedPackageVersion('@scope/pkg')).resolves.toBe('1.2.3')

    vi.stubEnv('VF_TEST_NPM_VIEW_VERSION', '9.9.9')
    vi.stubEnv('VF_TEST_NPM_VIEW_DELAY_MS', '200')
    await expect(resolvePublishedPackageVersion('@scope/pkg')).resolves.toBe('1.2.3')

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('timed out after 20ms'))
  })

  it('waits for npm view when no cached package version exists yet', async () => {
    await installFakeNpm()
    vi.stubEnv('VF_TEST_NPM_VIEW_VERSION', '3.0.0')
    vi.stubEnv('VF_TEST_NPM_VIEW_DELAY_MS', '50')

    await expect(resolvePublishedPackageVersion('@scope/uncached')).resolves.toBe('3.0.0')
  })
})
