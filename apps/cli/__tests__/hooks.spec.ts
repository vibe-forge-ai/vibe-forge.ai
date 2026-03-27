import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  listInstalledAdapterPackages,
  readInstalledAdapterScopeEntries,
  resolveActiveNativeHookBridge
} from '#~/hooks/bridge-loader.js'
import { runHookEntrypoint } from '#~/hooks/entry.js'

const tempDirs: string[] = []

afterEach(async () => {
  delete process.env.__VF_VIBE_FORGE_HOOK_BRIDGE_ADAPTER__
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('hook bridge loader', () => {
  it('treats pnpm symlinked adapter entries as installed packages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vf-hook-loader-'))
    tempDirs.push(root)
    const scopeDir = join(root, '@vibe-forge')
    const targetDir = join(root, 'targets', 'adapter-codex')

    await mkdir(targetDir, { recursive: true })
    await mkdir(scopeDir, { recursive: true })
    await symlink(targetDir, join(scopeDir, 'adapter-codex'))

    expect(readInstalledAdapterScopeEntries(scopeDir)).toEqual(['adapter-codex'])
  })

  it('discovers installed adapter packages from available search paths', () => {
    expect(
      listInstalledAdapterPackages({
        resolveSearchPaths: () => ['/node_modules', '/other/node_modules'],
        readAdapterScopeEntries: (scopeDir) => {
          if (scopeDir === '/node_modules/@vibe-forge') return ['adapter-codex', 'adapter-claude-code']
          if (scopeDir === '/other/node_modules/@vibe-forge') return ['adapter-codex', 'adapter-opencode']
          return []
        },
        hasHookBridgeExport: () => false,
        loadHookBridge: () => undefined
      })
    ).toEqual([
      '@vibe-forge/adapter-claude-code',
      '@vibe-forge/adapter-codex',
      '@vibe-forge/adapter-opencode'
    ])
  })

  it('loads the active native hook bridge from installed adapters only', () => {
    const activeBridge = {
      isNativeHookEnv: () => true,
      runHookBridge: vi.fn()
    }

    const result = resolveActiveNativeHookBridge({
      resolveSearchPaths: () => ['/node_modules'],
      readAdapterScopeEntries: () => ['adapter-codex', 'adapter-opencode'],
      hasHookBridgeExport: (packageName) => packageName !== '@vibe-forge/adapter-opencode',
      loadHookBridge: (packageName) => (
        packageName === '@vibe-forge/adapter-codex'
          ? activeBridge
          : { invalid: true }
      )
    })

    expect(result).toBe(activeBridge)
  })

  it('prefers the adapter declared by the shared hook bridge env', () => {
    process.env.__VF_VIBE_FORGE_HOOK_BRIDGE_ADAPTER__ = 'codex'
    const activeBridge = {
      isNativeHookEnv: () => true,
      runHookBridge: vi.fn()
    }
    const resolveSearchPaths = vi.fn(() => ['/node_modules'])

    const result = resolveActiveNativeHookBridge({
      resolveSearchPaths,
      readAdapterScopeEntries: () => ['adapter-codex'],
      hasHookBridgeExport: (packageName) => packageName === '@vibe-forge/adapter-codex',
      loadHookBridge: (packageName) => (
        packageName === '@vibe-forge/adapter-codex'
          ? activeBridge
          : undefined
      )
    })

    expect(result).toBe(activeBridge)
    expect(resolveSearchPaths).not.toHaveBeenCalled()
  })

  it('falls back to scanning installed adapters when the preferred bridge fails to load', () => {
    process.env.__VF_VIBE_FORGE_HOOK_BRIDGE_ADAPTER__ = 'codex'
    const fallbackBridge = {
      isNativeHookEnv: () => true,
      runHookBridge: vi.fn()
    }

    const result = resolveActiveNativeHookBridge({
      resolveSearchPaths: () => ['/node_modules'],
      readAdapterScopeEntries: () => ['adapter-codex', 'adapter-claude-code'],
      hasHookBridgeExport: () => true,
      loadHookBridge: (packageName) => {
        if (packageName === '@vibe-forge/adapter-codex') {
          throw Object.assign(new Error('boom'), { code: 'ERR_MODULE_NOT_FOUND' })
        }
        return packageName === '@vibe-forge/adapter-claude-code' ? fallbackBridge : undefined
      }
    })

    expect(result).toBe(fallbackBridge)
  })
})

describe('hook entrypoint', () => {
  it('runs the active native adapter bridge when one is available', async () => {
    const runHookBridge = vi.fn()
    const runHookCli = vi.fn()

    await runHookEntrypoint({
      resolveActiveNativeHookBridge: () => ({
        isNativeHookEnv: () => true,
        runHookBridge
      }),
      runHookCli
    })

    expect(runHookBridge).toHaveBeenCalledTimes(1)
    expect(runHookCli).not.toHaveBeenCalled()
  })

  it('falls back to the default hook cli when no native bridge is active', async () => {
    const runHookCli = vi.fn()

    await runHookEntrypoint({
      resolveActiveNativeHookBridge: () => undefined,
      runHookCli
    })

    expect(runHookCli).toHaveBeenCalledTimes(1)
  })

  it('falls back to the default hook cli when native bridge resolution throws', async () => {
    const runHookCli = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runHookEntrypoint({
      resolveActiveNativeHookBridge: () => {
        throw new Error('load failed')
      },
      runHookCli
    })

    expect(runHookCli).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })
})
