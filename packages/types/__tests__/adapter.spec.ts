import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadAdapter, normalizeAdapterPackageId, resolveAdapterPackageName } from '@vibe-forge/types'

const tempDirs: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

const writeAdapterPackage = async (packageDir: string, adapterId: string) => {
  const adapterRoot = join(packageDir, 'node_modules/@acme/custom-adapter')
  await mkdir(join(adapterRoot, 'dist'), { recursive: true })
  await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: '@acme/runtime' }, null, 2))
  await writeFile(
    join(adapterRoot, 'package.json'),
    JSON.stringify(
      {
        name: '@acme/custom-adapter',
        version: '1.0.0',
        exports: {
          '.': './dist/index.js',
          './package.json': './package.json'
        }
      },
      null,
      2
    )
  )
  await writeFile(
    join(adapterRoot, 'dist/index.js'),
    `module.exports = { default: { id: ${JSON.stringify(adapterId)} } }\n`
  )
}

describe('adapter package helpers', () => {
  it('maps claude adapter aliases to the claude-code package', () => {
    expect(normalizeAdapterPackageId('claude')).toBe('claude-code')
    expect(normalizeAdapterPackageId('adapter-claude')).toBe('adapter-claude-code')
    expect(resolveAdapterPackageName('claude')).toBe('@vibe-forge/adapter-claude-code')
    expect(resolveAdapterPackageName('adapter-claude')).toBe('@vibe-forge/adapter-claude-code')
  })

  it('keeps other adapter ids unchanged', () => {
    expect(normalizeAdapterPackageId('codex')).toBe('codex')
    expect(normalizeAdapterPackageId('adapter-codex')).toBe('adapter-codex')
    expect(resolveAdapterPackageName('codex')).toBe('@vibe-forge/adapter-codex')
    expect(resolveAdapterPackageName('adapter-codex')).toBe('@vibe-forge/adapter-codex')
    expect(resolveAdapterPackageName('@scope/custom-adapter')).toBe('@scope/custom-adapter')
  })

  it('loads adapters from the caller package dir before the active runtime package dir', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'vf-adapter-resolver-'))
    tempDirs.push(tempDir)

    const callerPackageDir = join(tempDir, 'caller-package')
    const runtimePackageDir = join(tempDir, 'runtime-package')
    await writeAdapterPackage(callerPackageDir, 'caller')
    await writeAdapterPackage(runtimePackageDir, 'runtime')

    vi.stubEnv('__VF_PROJECT_CLI_PACKAGE_DIR__', callerPackageDir)
    vi.stubEnv('__VF_PROJECT_PACKAGE_DIR__', runtimePackageDir)

    await expect(loadAdapter('@acme/custom-adapter')).resolves.toMatchObject({
      id: 'caller'
    })
  })
})
