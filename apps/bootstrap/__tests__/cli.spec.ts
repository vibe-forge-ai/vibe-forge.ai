import { describe, expect, it, vi } from 'vitest'

import { createBootstrapCli, routeBootstrapCommand } from '../src/program'

describe('bootstrap cli', () => {
  it('routes reserved web command to the web package', () => {
    expect(routeBootstrapCommand('web', ['--port', '8787'])).toEqual({
      commandName: 'vibe-forge-web',
      forwardedArgs: ['--port', '8787'],
      kind: 'package',
      packageName: '@vibe-forge/web'
    })
  })

  it('routes app to the desktop launcher', () => {
    expect(routeBootstrapCommand('app', [])).toEqual({
      forwardedArgs: [],
      kind: 'desktop',
      persistInstallMode: false
    })
  })

  it('routes app cache to the desktop launcher in cache mode', () => {
    expect(routeBootstrapCommand('app', ['cache'])).toEqual({
      forwardedArgs: [],
      installMode: 'cache',
      kind: 'desktop',
      persistInstallMode: true
    })
  })

  it('routes app --no-cache to the desktop launcher in user mode', () => {
    expect(routeBootstrapCommand('app', ['--no-cache'])).toEqual({
      forwardedArgs: [],
      installMode: 'user',
      kind: 'desktop',
      persistInstallMode: true
    })
  })

  it('routes unknown commands through the CLI package', () => {
    expect(routeBootstrapCommand('run', ['hello'])).toEqual({
      commandName: 'vibe-forge',
      forwardedArgs: ['run', 'hello'],
      kind: 'package',
      packageName: '@vibe-forge/cli'
    })
  })

  it('dispatches the desktop launcher for app', async () => {
    const launchDesktopApp = vi.fn(async () => {})
    const launchInstalledPackage = vi.fn(async () => 0)
    const cli = createBootstrapCli({
      launchDesktopApp,
      launchInstalledPackage
    })

    await cli.parseAsync(['node', 'vibe-forge-bootstrap', 'app'])

    expect(launchDesktopApp).toHaveBeenCalledWith({
      forwardedArgs: [],
      installMode: undefined,
      persistInstallMode: false
    })
    expect(launchInstalledPackage).not.toHaveBeenCalled()
  })

  it('dispatches cache mode for app cache', async () => {
    const launchDesktopApp = vi.fn(async () => {})
    const launchInstalledPackage = vi.fn(async () => 0)
    const cli = createBootstrapCli({
      launchDesktopApp,
      launchInstalledPackage
    })

    await cli.parseAsync(['node', 'vibe-forge-bootstrap', 'app', 'cache'])

    expect(launchDesktopApp).toHaveBeenCalledWith({
      forwardedArgs: [],
      installMode: 'cache',
      persistInstallMode: true
    })
    expect(launchInstalledPackage).not.toHaveBeenCalled()
  })

  it('dispatches forwarded commands through the CLI package', async () => {
    const launchDesktopApp = vi.fn(async () => {})
    const launchInstalledPackage = vi.fn(async () => 0)
    const cli = createBootstrapCli({
      launchDesktopApp,
      launchInstalledPackage
    })

    await cli.parseAsync(['node', 'vibe-forge-bootstrap', 'run', 'hello'])

    expect(launchInstalledPackage).toHaveBeenCalledWith({
      packageName: '@vibe-forge/cli',
      commandName: 'vibe-forge',
      forwardedArgs: ['run', 'hello']
    })
    expect(launchDesktopApp).not.toHaveBeenCalled()
  })

  it('forwards --help after a routed command', async () => {
    const launchDesktopApp = vi.fn(async () => {})
    const launchInstalledPackage = vi.fn(async () => 0)
    const cli = createBootstrapCli({
      launchDesktopApp,
      launchInstalledPackage
    })

    await cli.parseAsync(['node', 'vibe-forge-bootstrap', 'web', '--help'])

    expect(launchInstalledPackage).toHaveBeenCalledWith({
      packageName: '@vibe-forge/web',
      commandName: 'vibe-forge-web',
      forwardedArgs: ['--help']
    })
  })

  it('strips --debug before forwarding and enables bootstrap debug mode', async () => {
    const launchDesktopApp = vi.fn(async () => {})
    const launchInstalledPackage = vi.fn(async () => 0)
    const cli = createBootstrapCli({
      launchDesktopApp,
      launchInstalledPackage
    })
    const originalDebug = process.env.VF_BOOTSTRAP_DEBUG

    delete process.env.VF_BOOTSTRAP_DEBUG
    await cli.parseAsync(['node', 'vibe-forge-bootstrap', 'web', '--debug', '--help'])

    expect(launchInstalledPackage).toHaveBeenCalledWith({
      packageName: '@vibe-forge/web',
      commandName: 'vibe-forge-web',
      forwardedArgs: ['--help']
    })
    expect(process.env.VF_BOOTSTRAP_DEBUG).toBe('1')

    if (originalDebug == null) {
      delete process.env.VF_BOOTSTRAP_DEBUG
    } else {
      process.env.VF_BOOTSTRAP_DEBUG = originalDebug
    }
  })

  it('prints app help without launching the desktop app', async () => {
    const launchDesktopApp = vi.fn(async () => {})
    const launchInstalledPackage = vi.fn(async () => 0)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const cli = createBootstrapCli({
      launchDesktopApp,
      launchInstalledPackage
    })

    await cli.parseAsync(['node', 'vibe-forge-bootstrap', 'app', '--help'])

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: vibe-forge-bootstrap app'))
    expect(launchDesktopApp).not.toHaveBeenCalled()
    expect(launchInstalledPackage).not.toHaveBeenCalled()

    writeSpy.mockRestore()
  })
})
