import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureOpenCodeNativeHooksInstalled } from '../src/runtime/native-hooks'

const tempDirs: string[] = []

const createTempDir = async (prefix: string) => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const createBarrier = (size: number) => {
  let pending = size
  let release: (() => void) | undefined
  const waitForAll = new Promise<void>((resolve) => {
    release = resolve
  })

  return async () => {
    pending -= 1
    if (pending === 0) {
      release?.()
    }
    await waitForAll
  }
}

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, { encoding: 'utf8', flag: 'w' })
}

afterEach(async () => {
  delete process.env.__VF_PROJECT_REAL_HOME__
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('ensureOpenCodeNativeHooksInstalled', () => {
  it('creates an isolated mock config dir and installs the managed plugin there', async () => {
    const workspace = await createTempDir('opencode-hooks-workspace-')
    const realHome = await createTempDir('opencode-hooks-home-')
    const mockHome = join(workspace, '.ai', '.mock')

    await writeDocument(
      join(realHome, '.config', 'opencode', 'opencode.json'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json'
      })
    )
    await writeDocument(join(realHome, '.config', 'opencode', 'commands', 'review.md'), '# review')
    process.env.__VF_PROJECT_REAL_HOME__ = realHome

    const ctx = {
      cwd: workspace,
      env: {
        HOME: mockHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: [
          {
            id: 'hookPlugin:project:logger'
          }
        ]
      }
    } as any

    const installed = await ensureOpenCodeNativeHooksInstalled(ctx)
    const managedConfigDir = join(mockHome, '.config', 'opencode')
    const pluginPath = join(managedConfigDir, 'plugins', 'vibe-forge-hooks.js')

    expect(installed).toBe(true)
    expect(ctx.env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__).toBe('1')
    expect(ctx.env.OPENCODE_CONFIG_DIR).toBe(managedConfigDir)
    expect((await lstat(managedConfigDir)).isDirectory()).toBe(true)
    expect((await lstat(join(managedConfigDir, 'commands'))).isSymbolicLink()).toBe(true)
    expect(await readFile(pluginPath, 'utf8')).toContain('tool.execute.before')
    expect(JSON.parse(await readFile(join(managedConfigDir, 'opencode.json'), 'utf8'))).toMatchObject({
      $schema: 'https://opencode.ai/config.json'
    })
  })

  it('installs the managed bridge when builtin permission hooks are enabled without user plugins', async () => {
    const workspace = await createTempDir('opencode-hooks-builtin-')
    const mockHome = join(workspace, '.ai', '.mock')
    const ctx = {
      cwd: workspace,
      env: {
        HOME: mockHome,
        __VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__: '1'
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {}
    } as any

    const installed = await ensureOpenCodeNativeHooksInstalled(ctx)
    const pluginPath = join(mockHome, '.config', 'opencode', 'plugins', 'vibe-forge-hooks.js')
    const configPath = join(mockHome, '.config', 'opencode', 'opencode.json')

    expect(installed).toBe(true)
    expect(ctx.env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__).toBe('1')
    expect(await readFile(pluginPath, 'utf8')).toContain('tool.execute.before')
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toMatchObject({
      $schema: 'https://opencode.ai/config.json',
      autoupdate: false
    })
  })

  it('preserves an existing managed opencode.json when the source config directory has no config file', async () => {
    const workspace = await createTempDir('opencode-hooks-existing-config-')
    const realHome = await createTempDir('opencode-hooks-existing-home-')
    const mockHome = join(workspace, '.ai', '.mock')
    const managedConfigPath = join(mockHome, '.config', 'opencode', 'opencode.json')

    await writeDocument(join(realHome, '.config', 'opencode', 'commands', 'review.md'), '# review')
    await writeDocument(
      managedConfigPath,
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        autoupdate: true,
        theme: 'existing'
      })
    )
    process.env.__VF_PROJECT_REAL_HOME__ = realHome

    const ctx = {
      cwd: workspace,
      env: {
        HOME: mockHome
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {}
    } as any

    const installed = await ensureOpenCodeNativeHooksInstalled(ctx)

    expect(installed).toBe(false)
    expect((await lstat(join(mockHome, '.config', 'opencode', 'commands'))).isSymbolicLink()).toBe(true)
    expect(JSON.parse(await readFile(managedConfigPath, 'utf8'))).toEqual({
      $schema: 'https://opencode.ai/config.json',
      autoupdate: true,
      theme: 'existing'
    })
  })

  it('keeps concurrent mock-home config mirroring idempotent when multiple vf processes install native hooks together', async () => {
    const workspace = await createTempDir('opencode-hooks-race-workspace-')
    const realHome = await createTempDir('opencode-hooks-race-home-')
    const mockHome = join(workspace, '.ai', '.mock')
    const barrier = createBarrier(2)

    await writeDocument(join(realHome, '.config', 'opencode', 'commands', 'review.md'), '# review')
    process.env.__VF_PROJECT_REAL_HOME__ = realHome

    vi.resetModules()
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        symlink: vi.fn(async (...args: Parameters<typeof actual.symlink>) => {
          const [, targetPath] = args
          if (String(targetPath).endsWith(join('opencode', 'commands'))) {
            await barrier()
          }
          return actual.symlink(...args)
        })
      }
    })

    try {
      const { ensureOpenCodeNativeHooksInstalled: ensureOpenCodeNativeHooksInstalledWithMockedFs } = await import(
        '../src/runtime/native-hooks'
      )
      const ctx = {
        cwd: workspace,
        env: {
          HOME: mockHome
        },
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        },
        assets: {
          hookPlugins: [{ id: 'hookPlugin:project:logger' }]
        }
      } as any

      await expect(
        Promise.all([
          ensureOpenCodeNativeHooksInstalledWithMockedFs(ctx),
          ensureOpenCodeNativeHooksInstalledWithMockedFs(ctx)
        ])
      ).resolves.toEqual([true, true])
      const commandsPath = join(mockHome, '.config', 'opencode', 'commands')
      expect((await lstat(commandsPath)).isSymbolicLink()).toBe(true)
      expect(resolve(dirname(commandsPath), await readlink(commandsPath))).toBe(
        resolve(realHome, '.config', 'opencode', 'commands')
      )
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })
})
