import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { __TEST_ONLY__ } from '../src/desktop-app'

describe('desktop asset selection', () => {
  const release = {
    tagName: 'desktop-v0.1.7',
    assets: [
      { name: 'vibe-forge-0.1.7-mac-arm64.zip', url: 'https://example.com/mac-arm64.zip' },
      { name: 'vibe-forge-0.1.7-linux-x86_64.AppImage', url: 'https://example.com/linux.AppImage' },
      { name: 'vibe-forge-0.1.7-win-x64.exe', url: 'https://example.com/win.exe' }
    ]
  }

  it('selects a matching macOS archive', () => {
    expect(__TEST_ONLY__.selectDesktopAsset(release, {
      platform: 'darwin',
      arch: 'arm64'
    })).toEqual(release.assets[0])
  })

  it('selects a matching Linux AppImage', () => {
    expect(__TEST_ONLY__.selectDesktopAsset(release, {
      platform: 'linux',
      arch: 'x64'
    })).toEqual(release.assets[1])
  })

  it('selects a matching Windows installer when present', () => {
    expect(__TEST_ONLY__.selectDesktopAsset(release, {
      platform: 'win32',
      arch: 'x64'
    })).toEqual(release.assets[2])
  })
})

describe('desktop install mode resolution', () => {
  const originalRealHome = process.env.__VF_PROJECT_REAL_HOME__
  const originalStdinIsTTY = process.stdin.isTTY
  const originalStdoutIsTTY = process.stdout.isTTY
  let tempHomeDir = ''

  beforeEach(async () => {
    tempHomeDir = await mkdtemp(path.join(os.tmpdir(), 'vf-bootstrap-'))
    process.env.__VF_PROJECT_REAL_HOME__ = tempHomeDir
  })

  afterEach(async () => {
    if (originalRealHome == null) {
      delete process.env.__VF_PROJECT_REAL_HOME__
    } else {
      process.env.__VF_PROJECT_REAL_HOME__ = originalRealHome
    }
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalStdinIsTTY })
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: originalStdoutIsTTY })
    await rm(tempHomeDir, { recursive: true, force: true })
  })

  it('uses an explicit cache mode without prompting', async () => {
    await expect(__TEST_ONLY__.resolveInstallMode({
      explicitInstallMode: 'cache',
      persistInstallMode: true
    })).resolves.toBe('cache')
    await expect(__TEST_ONLY__.readDesktopPreference()).resolves.toEqual({
      installMode: 'cache'
    })
  })

  it('uses an explicit user mode and stores it as the default', async () => {
    await expect(__TEST_ONLY__.resolveInstallMode({
      explicitInstallMode: 'user',
      persistInstallMode: true
    })).resolves.toBe('user')
    await expect(__TEST_ONLY__.readDesktopPreference()).resolves.toEqual({
      installMode: 'user'
    })
  })

  it('defaults to user mode when no tty is available', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false })
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false })

    await expect(__TEST_ONLY__.resolveInstallMode({
      explicitInstallMode: undefined,
      persistInstallMode: false
    })).resolves.toBe('user')
  })

  it('reuses the stored cache preference', async () => {
    await mkdir(path.join(tempHomeDir, '.vibe-forge', 'bootstrap', 'desktop'), { recursive: true })
    await writeFile(
      path.join(tempHomeDir, '.vibe-forge', 'bootstrap', 'desktop', 'preferences.json'),
      `${JSON.stringify({ installMode: 'cache' }, null, 2)}\n`
    )

    await expect(__TEST_ONLY__.resolveInstallMode({
      explicitInstallMode: undefined,
      persistInstallMode: false
    })).resolves.toBe('cache')
  })
})
