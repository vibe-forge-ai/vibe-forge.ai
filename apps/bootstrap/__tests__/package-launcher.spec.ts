import process from 'node:process'

import { afterEach, describe, expect, it, vi } from 'vitest'

const resolveInstalledPackageBin = vi.fn()
const resolvePublishedPackageVersion = vi.fn()
const installPublishedPackage = vi.fn()
const resolvePackageBinEntrypoint = vi.fn()
const runNodeEntrypoint = vi.fn()

vi.mock('../src/installed-package', () => ({
  resolveInstalledPackageBin
}))

vi.mock('../src/npm-package', () => ({
  installPublishedPackage,
  resolvePackageBinEntrypoint,
  resolvePublishedPackageVersion
}))

vi.mock('../src/process-utils', () => ({
  runNodeEntrypoint
}))

const { launchInstalledPackage } = await import('../src/package-launcher')

const originalLookupBase = process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE
const originalDebug = process.env.VF_BOOTSTRAP_DEBUG

afterEach(() => {
  vi.clearAllMocks()

  if (originalLookupBase == null) {
    delete process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE
  } else {
    process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE = originalLookupBase
  }

  if (originalDebug == null) {
    delete process.env.VF_BOOTSTRAP_DEBUG
  } else {
    process.env.VF_BOOTSTRAP_DEBUG = originalDebug
  }
})

describe('package launcher', () => {
  it('does not print bootstrap source logs by default', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE = '/tmp/harness'
    resolveInstalledPackageBin.mockReturnValue('/tmp/harness/node_modules/.bin/vibe-forge-web')
    runNodeEntrypoint.mockResolvedValue(0)

    await launchInstalledPackage({
      packageName: '@vibe-forge/web',
      commandName: 'vibe-forge-web',
      forwardedArgs: ['--help']
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('prints bootstrap source logs when debug is enabled', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.VF_BOOTSTRAP_DEBUG = '1'
    process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE = '/tmp/harness'
    resolveInstalledPackageBin.mockReturnValue('/tmp/harness/node_modules/.bin/vibe-forge-web')
    runNodeEntrypoint.mockResolvedValue(0)

    await launchInstalledPackage({
      packageName: '@vibe-forge/web',
      commandName: 'vibe-forge-web',
      forwardedArgs: ['--help']
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[bootstrap] using installed @vibe-forge/web from /tmp/harness'
    )
    consoleErrorSpy.mockRestore()
  })

  it('prefers a locally installed package when lookup base is configured', async () => {
    process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE = '/tmp/harness'
    resolveInstalledPackageBin.mockReturnValue('/tmp/harness/node_modules/.bin/vibe-forge-web')
    runNodeEntrypoint.mockResolvedValue(0)

    const exitCode = await launchInstalledPackage({
      packageName: '@vibe-forge/web',
      commandName: 'vibe-forge-web',
      forwardedArgs: ['--help']
    })

    expect(resolveInstalledPackageBin).toHaveBeenCalledWith(
      '@vibe-forge/web',
      '/tmp/harness',
      'vibe-forge-web'
    )
    expect(runNodeEntrypoint).toHaveBeenCalledWith(
      '/tmp/harness/node_modules/.bin/vibe-forge-web',
      ['--help']
    )
    expect(resolvePublishedPackageVersion).not.toHaveBeenCalled()
    expect(exitCode).toBe(0)
  })

  it('falls back to the published package flow when local resolution fails', async () => {
    process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE = '/tmp/harness'
    resolveInstalledPackageBin.mockImplementation(() => {
      throw new Error('missing local install')
    })
    resolvePublishedPackageVersion.mockResolvedValue('2.0.0')
    installPublishedPackage.mockResolvedValue({
      packageDir: '/tmp/bootstrap-cache/node_modules/@vibe-forge/cli',
      version: '2.0.0'
    })
    resolvePackageBinEntrypoint.mockResolvedValue('/tmp/bootstrap-cache/node_modules/@vibe-forge/cli/cli.js')
    runNodeEntrypoint.mockResolvedValue(0)

    const exitCode = await launchInstalledPackage({
      packageName: '@vibe-forge/cli',
      commandName: 'vibe-forge',
      forwardedArgs: ['run', 'hi']
    })

    expect(resolvePublishedPackageVersion).toHaveBeenCalledWith('@vibe-forge/cli')
    expect(installPublishedPackage).toHaveBeenCalledWith('@vibe-forge/cli', '2.0.0')
    expect(resolvePackageBinEntrypoint).toHaveBeenCalledWith(
      '/tmp/bootstrap-cache/node_modules/@vibe-forge/cli',
      'vibe-forge'
    )
    expect(runNodeEntrypoint).toHaveBeenCalledWith(
      '/tmp/bootstrap-cache/node_modules/@vibe-forge/cli/cli.js',
      ['run', 'hi']
    )
    expect(exitCode).toBe(0)
  })
})
