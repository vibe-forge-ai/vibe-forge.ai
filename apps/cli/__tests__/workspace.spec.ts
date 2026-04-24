import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { Command } from 'commander'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateAdapterQueryOptions, run } from '@vibe-forge/app-runtime'

import { registerRunCommand } from '#~/commands/run.js'
import { listCliSessions, writeCliSessionRecord } from '#~/session-cache.js'
import { readCliSessionPermissionRecovery, writeCliSessionPermissionRecovery } from '#~/session-permission-cache.js'
import { resolveCliWorkspaceCwd } from '#~/workspace.js'

const configMocks = vi.hoisted(() => ({
  loadConfigState: vi.fn(async () => ({ mergedConfig: {} })),
  loadInjectDefaultSystemPromptValue: vi.fn(async () => undefined),
  mergeSystemPrompts: vi.fn(({ generatedSystemPrompt, userSystemPrompt }) => (
    userSystemPrompt ?? generatedSystemPrompt
  ))
}))

vi.mock('@vibe-forge/app-runtime', () => ({
  generateAdapterQueryOptions: vi.fn(async () => [
    {},
    {
      systemPrompt: undefined,
      tools: undefined,
      mcpServers: undefined,
      promptAssetIds: undefined,
      assetBundle: undefined
    }
  ]),
  run: vi.fn(async () => ({
    session: {
      pid: 321,
      kill: vi.fn(),
      stop: vi.fn()
    },
    resolvedAdapter: 'codex'
  }))
}))

vi.mock('@vibe-forge/config', () => ({
  loadConfigState: configMocks.loadConfigState,
  loadInjectDefaultSystemPromptValue: configMocks.loadInjectDefaultSystemPromptValue,
  mergeSystemPrompts: configMocks.mergeSystemPrompts
}))

vi.mock('@vibe-forge/hooks', () => ({
  callHook: vi.fn(async () => undefined)
}))

const tempDirs: string[] = []
const originalCwd = process.cwd()
const hasGit = spawnSync('git', ['--version']).status === 0

const createWorkspaceFixture = async () => {
  const cleanupDir = await fs.mkdtemp(path.join(tmpdir(), 'vf-cli-workspace-'))
  tempDirs.push(cleanupDir)

  const workspaceDir = await fs.realpath(cleanupDir)
  const launchDir = path.join(workspaceDir, 'business_modules', 'Miniapp')
  await fs.mkdir(launchDir, { recursive: true })

  return {
    workspaceDir,
    launchDir
  }
}

const runGit = (cwd: string, args: string[]) => {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe'
  })
}

afterEach(async () => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  configMocks.loadConfigState.mockResolvedValue({ mergedConfig: {} })
  process.chdir(originalCwd)
  delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
  delete process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

describe('cli workspace resolution', () => {
  it('resolves the effective workspace cwd from env overrides', async () => {
    const { workspaceDir, launchDir } = await createWorkspaceFixture()

    process.chdir(launchDir)
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = '../..'

    expect(resolveCliWorkspaceCwd()).toBe(workspaceDir)
  })

  it('passes the resolved workspace cwd into run command execution', async () => {
    const { workspaceDir, launchDir } = await createWorkspaceFixture()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    process.chdir(launchDir)
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = '../..'

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync(['run', '--print', '现在工作目录是什么'], { from: 'user' })

    expect(generateAdapterQueryOptions).toHaveBeenCalledTimes(1)
    expect(vi.mocked(generateAdapterQueryOptions).mock.calls[0]?.[2]).toBe(workspaceDir)
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: workspaceDir
      }),
      expect.any(Object)
    )

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('defaults create runs to bypassPermissions when no CLI flag or config default is set', async () => {
    const { workspaceDir } = await createWorkspaceFixture()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    process.chdir(workspaceDir)

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync(['run', '--print', 'smoke'], { from: 'user' })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: workspaceDir
      }),
      expect.objectContaining({
        type: 'create',
        permissionMode: 'bypassPermissions'
      })
    )

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('lets config defaultMode override the CLI built-in permission default for create runs', async () => {
    const { workspaceDir } = await createWorkspaceFixture()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    configMocks.loadConfigState.mockResolvedValue({
      mergedConfig: {
        permissions: {
          defaultMode: 'plan'
        }
      }
    })

    process.chdir(workspaceDir)

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync(['run', '--print', 'smoke'], { from: 'user' })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: workspaceDir
      }),
      expect.objectContaining({
        type: 'create',
        permissionMode: 'plan'
      })
    )

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('preserves a config defaultMode of default instead of falling back to bypassPermissions', async () => {
    const { workspaceDir } = await createWorkspaceFixture()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    configMocks.loadConfigState.mockResolvedValue({
      mergedConfig: {
        permissions: {
          defaultMode: 'default'
        }
      }
    })

    process.chdir(workspaceDir)

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync(['run', '--print', 'smoke'], { from: 'user' })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: workspaceDir
      }),
      expect.objectContaining({
        type: 'create',
        permissionMode: 'default'
      })
    )

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it.skipIf(!hasGit)('passes the primary git worktree folder into run command env', async () => {
    const cleanupDir = await fs.mkdtemp(path.join(tmpdir(), 'vf-cli-worktree-'))
    tempDirs.push(cleanupDir)
    const primary = path.join(cleanupDir, 'primary')
    const linked = path.join(cleanupDir, 'linked')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await fs.mkdir(primary, { recursive: true })
    runGit(primary, ['init'])
    await fs.writeFile(path.join(primary, 'README.md'), 'hello\n', 'utf8')
    runGit(primary, ['add', 'README.md'])
    runGit(primary, [
      '-c',
      'user.email=vf@example.test',
      '-c',
      'user.name=Vibe Forge',
      'commit',
      '-m',
      'init'
    ])
    runGit(primary, ['worktree', 'add', '--detach', linked, 'HEAD'])

    process.chdir(linked)

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync(['run', '--print', 'smoke'], { from: 'user' })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: await fs.realpath(linked),
        env: expect.objectContaining({
          __VF_PROJECT_WORKSPACE_FOLDER__: await fs.realpath(linked),
          __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: await fs.realpath(primary)
        })
      }),
      expect.any(Object)
    )

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('reads cached sessions from the resolved workspace cwd', async () => {
    const { workspaceDir, launchDir } = await createWorkspaceFixture()

    await writeCliSessionRecord(workspaceDir, 'ctx-demo', 'session-demo', {
      resume: {
        version: 1,
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        cwd: workspaceDir,
        description: 'Check workspace override',
        createdAt: 1,
        updatedAt: 2,
        resolvedAdapter: 'codex',
        taskOptions: {
          adapter: 'codex',
          cwd: workspaceDir,
          ctxId: 'ctx-demo'
        },
        adapterOptions: {
          runtime: 'cli',
          sessionId: 'session-demo',
          mode: 'direct'
        },
        outputFormat: 'text'
      }
    })

    process.chdir(launchDir)
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = '../..'

    const records = await listCliSessions(resolveCliWorkspaceCwd())
    expect(records.some(record => record.resume?.sessionId === 'session-demo')).toBe(true)
  })

  it('allows resume to override the cached permission mode for the next run', async () => {
    const { workspaceDir } = await createWorkspaceFixture()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await writeCliSessionRecord(workspaceDir, 'ctx-demo', 'session-demo', {
      resume: {
        version: 1,
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        cwd: workspaceDir,
        description: 'Resume with updated permissions',
        createdAt: 1,
        updatedAt: 2,
        resolvedAdapter: 'codex',
        taskOptions: {
          adapter: 'codex',
          cwd: workspaceDir,
          ctxId: 'ctx-demo'
        },
        adapterOptions: {
          runtime: 'cli',
          sessionId: 'session-demo',
          mode: 'direct',
          permissionMode: 'plan'
        },
        outputFormat: 'text'
      }
    })
    await writeCliSessionPermissionRecovery(workspaceDir, 'ctx-demo', 'session-demo', {
      version: 1,
      sessionId: 'session-demo',
      adapter: 'codex',
      permissionMode: 'plan',
      subjectKeys: ['Read'],
      payload: {
        sessionId: 'session-demo',
        kind: 'permission',
        question: 'Need Read tool.',
        options: []
      }
    })

    process.chdir(workspaceDir)

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync([
      'run',
      '--resume',
      'session-demo',
      '--permission-mode',
      'bypassPermissions'
    ], { from: 'user' })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: workspaceDir
      }),
      expect.objectContaining({
        type: 'resume',
        permissionMode: 'bypassPermissions'
      })
    )

    const records = await listCliSessions(workspaceDir)
    const resumed = records.find(record => record.resume?.sessionId === 'session-demo')
    expect(resumed?.resume?.adapterOptions.permissionMode).toBe('bypassPermissions')
    await expect(readCliSessionPermissionRecovery(workspaceDir, 'ctx-demo', 'session-demo')).resolves.toBeUndefined()

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('defaults resumed runs to bypassPermissions when cache and config do not provide a mode', async () => {
    const { workspaceDir } = await createWorkspaceFixture()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await writeCliSessionRecord(workspaceDir, 'ctx-demo', 'session-demo', {
      resume: {
        version: 1,
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        cwd: workspaceDir,
        description: 'Resume with built-in default permission mode',
        createdAt: 1,
        updatedAt: 2,
        resolvedAdapter: 'codex',
        taskOptions: {
          adapter: 'codex',
          cwd: workspaceDir,
          ctxId: 'ctx-demo'
        },
        adapterOptions: {
          runtime: 'cli',
          sessionId: 'session-demo',
          mode: 'direct'
        },
        outputFormat: 'text'
      }
    })

    process.chdir(workspaceDir)

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync([
      'run',
      '--resume',
      'session-demo'
    ], { from: 'user' })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: workspaceDir
      }),
      expect.objectContaining({
        type: 'resume',
        permissionMode: 'bypassPermissions'
      })
    )

    const records = await listCliSessions(workspaceDir)
    const resumed = records.find(record => record.resume?.sessionId === 'session-demo')
    expect(resumed?.resume?.adapterOptions.permissionMode).toBe('bypassPermissions')

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('keeps the cached resume permission mode ahead of the config default', async () => {
    const { workspaceDir } = await createWorkspaceFixture()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    configMocks.loadConfigState.mockResolvedValue({
      mergedConfig: {
        permissions: {
          defaultMode: 'bypassPermissions'
        }
      }
    })

    await writeCliSessionRecord(workspaceDir, 'ctx-demo', 'session-demo', {
      resume: {
        version: 1,
        ctxId: 'ctx-demo',
        sessionId: 'session-demo',
        cwd: workspaceDir,
        description: 'Resume with cached permission mode',
        createdAt: 1,
        updatedAt: 2,
        resolvedAdapter: 'codex',
        taskOptions: {
          adapter: 'codex',
          cwd: workspaceDir,
          ctxId: 'ctx-demo'
        },
        adapterOptions: {
          runtime: 'cli',
          sessionId: 'session-demo',
          mode: 'direct',
          permissionMode: 'plan'
        },
        outputFormat: 'text'
      }
    })

    process.chdir(workspaceDir)

    const program = new Command()
    registerRunCommand(program)
    await program.parseAsync([
      'run',
      '--resume',
      'session-demo'
    ], { from: 'user' })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: workspaceDir
      }),
      expect.objectContaining({
        type: 'resume',
        permissionMode: 'plan'
      })
    )

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
