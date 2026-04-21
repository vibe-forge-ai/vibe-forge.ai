import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WSEvent } from '@vibe-forge/core'

import { SqliteDb, getDb } from '#~/db/index.js'
import { createSqliteDatabase } from '#~/db/sqlite.js'

vi.mock('#~/db/index.js', async () => {
  const actual = await vi.importActual<typeof import('#~/db/index.js')>('#~/db/index.js')
  return {
    ...actual,
    getDb: vi.fn()
  }
})

const runGit = (cwd: string, args: string[]) => {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe'
  })
}

const resolveExpectedManagedWorktreePath = (primaryWorkspaceRoot: string, workspaceRoot: string, sessionId: string) => (
  path.join(
    primaryWorkspaceRoot,
    '.ai',
    'worktrees',
    'sessions',
    sessionId,
    path.basename(workspaceRoot)
  )
)

const getPlatformScriptSuffix = () => {
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'linux') return 'linux'
  if (process.platform === 'win32') return 'windows'
  return undefined
}

const getPlatformScriptFileName = (operation: 'create' | 'start' | 'destroy') => {
  const platformSuffix = getPlatformScriptSuffix()
  if (platformSuffix == null) return undefined
  return platformSuffix === 'windows'
    ? `${operation}.windows.ps1`
    : `${operation}.${platformSuffix}.sh`
}

const getBaseScriptFileName = (operation: 'create' | 'start' | 'destroy') => (
  process.platform === 'win32' ? `${operation}.ps1` : `${operation}.sh`
)

const buildScriptContent = (shellContent: string, powershellContent: string) => (
  process.platform === 'win32' ? powershellContent : shellContent
)

describe('session workspace service', () => {
  let db: SqliteDb
  let workspaceRoot: string
  let primaryWorkspaceRoot: string
  let previousWorkspaceEnv: string | undefined
  let previousPrimaryWorkspaceEnv: string | undefined

  beforeEach(async () => {
    db = new SqliteDb({ db: createSqliteDatabase(':memory:') })
    vi.clearAllMocks()
    vi.resetModules()
    vi.mocked(getDb).mockReturnValue(db)

    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'vf-session-workspace-'))
    primaryWorkspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'vf-session-workspace-primary-'))
    previousWorkspaceEnv = process.env.__VF_PROJECT_WORKSPACE_FOLDER__
    previousPrimaryWorkspaceEnv = process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = workspaceRoot
    process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = primaryWorkspaceRoot

    runGit(workspaceRoot, ['init'])
    runGit(workspaceRoot, ['config', 'user.email', 'vf@example.com'])
    runGit(workspaceRoot, ['config', 'user.name', 'Vibe Forge'])
    await writeFile(path.join(workspaceRoot, 'README.md'), '# demo\n', 'utf8')
    runGit(workspaceRoot, ['add', 'README.md'])
    runGit(workspaceRoot, ['commit', '-m', 'init'])
    runGit(workspaceRoot, ['branch', '-M', 'main'])
  })

  afterEach(async () => {
    vi.doUnmock('node:process')
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = previousWorkspaceEnv
    process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = previousPrimaryWorkspaceEnv
    db.close()
    await rm(workspaceRoot, { recursive: true, force: true })
    await rm(primaryWorkspaceRoot, { recursive: true, force: true })
  })

  it('provisions a managed worktree for a new session in a git workspace', async () => {
    const { provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Demo', 'sess-1')

    const workspace = await provisionSessionWorkspace('sess-1')
    const expectedWorktreePath = resolveExpectedManagedWorktreePath(primaryWorkspaceRoot, workspaceRoot, 'sess-1')
    const currentBranch = execFileSync('git', ['branch', '--show-current'], {
      cwd: workspace.workspaceFolder,
      encoding: 'utf8'
    }).trim()

    expect(workspace).toMatchObject({
      sessionId: 'sess-1',
      kind: 'managed_worktree',
      workspaceFolder: expectedWorktreePath,
      repositoryRoot: expectedWorktreePath,
      worktreePath: expectedWorktreePath,
      baseRef: 'main',
      cleanupPolicy: 'delete_on_session_delete',
      state: 'ready'
    })
    expect(currentBranch).toBe('main-session-sess-1')
  })

  it('recovers legacy session cwd as an external workspace without creating a new worktree', async () => {
    const { resolveSessionWorkspace } = await import('#~/services/session/workspace.js')
    const session = db.createSession('Legacy', 'sess-legacy')
    const legacyDir = path.join(workspaceRoot, 'packages', 'app')
    await mkdir(legacyDir, { recursive: true })
    const legacyInitEvent: WSEvent = {
      type: 'session_info',
      info: {
        type: 'init',
        uuid: session.id,
        cwd: legacyDir,
        model: 'gpt-4o',
        version: 'test',
        adapter: 'codex',
        tools: [],
        slashCommands: [],
        agents: []
      }
    }
    db.saveMessage(session.id, legacyInitEvent)

    const workspace = await resolveSessionWorkspace(session.id)

    expect(workspace).toMatchObject({
      sessionId: session.id,
      kind: 'external_workspace',
      workspaceFolder: legacyDir,
      cleanupPolicy: 'retain',
      state: 'ready'
    })
    expect(workspace.repositoryRoot).toBeTruthy()
    expect(workspace.repositoryRoot).toContain(path.basename(workspaceRoot))
  })

  it('creates a managed worktree for an existing shared-workspace session', async () => {
    const {
      createSessionManagedWorktree,
      provisionSessionWorkspace
    } = await import('#~/services/session/workspace.js')
    db.createSession('Shared', 'sess-shared')

    const sharedWorkspace = await provisionSessionWorkspace('sess-shared', {
      createWorktree: false
    })
    expect(sharedWorkspace.kind).toBe('shared_workspace')

    const managedWorkspace = await createSessionManagedWorktree('sess-shared')
    const expectedWorktreePath = resolveExpectedManagedWorktreePath(primaryWorkspaceRoot, workspaceRoot, 'sess-shared')

    expect(managedWorkspace).toMatchObject({
      sessionId: 'sess-shared',
      kind: 'managed_worktree',
      workspaceFolder: expectedWorktreePath,
      worktreePath: expectedWorktreePath,
      cleanupPolicy: 'delete_on_session_delete',
      state: 'ready'
    })
  })

  it('runs configured worktree environment create scripts after creating a managed worktree', async () => {
    const { provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Env', 'sess-env')

    await writeFile(
      path.join(workspaceRoot, '.ai.config.json'),
      `${JSON.stringify({ conversation: { worktreeEnvironment: 'env-test' } }, null, 2)}\n`,
      'utf8'
    )
    const environmentDir = path.join(primaryWorkspaceRoot, '.ai', 'env', 'env-test')
    await mkdir(environmentDir, { recursive: true })
    await writeFile(
      path.join(environmentDir, getBaseScriptFileName('create')),
      buildScriptContent(
        'printf "base:%s:%s:%s\\n" "$VF_SESSION_ID" "$VF_WORKTREE_OPERATION" "$VF_WORKTREE_SOURCE_PATH" > env-create.log\n',
        'Set-Content -Path env-create.log -Value "base:$($env:VF_SESSION_ID):$($env:VF_WORKTREE_OPERATION):$($env:VF_WORKTREE_SOURCE_PATH)"\n'
      ),
      'utf8'
    )
    const platformScriptFileName = getPlatformScriptFileName('create')
    if (platformScriptFileName != null) {
      await writeFile(
        path.join(environmentDir, platformScriptFileName),
        buildScriptContent(
          'printf "platform:%s\\n" "$VF_WORKTREE_OPERATION" >> env-create.log\n',
          'Add-Content -Path env-create.log -Value "platform:$($env:VF_WORKTREE_OPERATION)"\n'
        ),
        'utf8'
      )
    }

    const workspace = await provisionSessionWorkspace('sess-env')
    const log = await readFile(path.join(workspace.workspaceFolder, 'env-create.log'), 'utf8')

    expect(log).toContain(`base:sess-env:create:${workspaceRoot}`)
    if (platformScriptFileName != null) {
      expect(log).toContain('platform:create')
    }
  })

  it('uses workspace project environment scripts when the primary checkout does not have them', async () => {
    const { provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Workspace Env', 'sess-workspace-env')

    await writeFile(
      path.join(workspaceRoot, '.ai.config.json'),
      `${JSON.stringify({ conversation: { worktreeEnvironment: 'default' } }, null, 2)}\n`,
      'utf8'
    )
    const environmentDir = path.join(workspaceRoot, '.ai', 'env', 'default')
    await mkdir(environmentDir, { recursive: true })
    await writeFile(
      path.join(environmentDir, getBaseScriptFileName('create')),
      buildScriptContent(
        'printf "workspace:%s\\n" "$VF_WORKTREE_ENV" > workspace-env.log\n',
        'Set-Content -Path workspace-env.log -Value "workspace:$($env:VF_WORKTREE_ENV)"\n'
      ),
      'utf8'
    )

    const workspace = await provisionSessionWorkspace('sess-workspace-env')
    const log = await readFile(path.join(workspace.workspaceFolder, 'workspace-env.log'), 'utf8')

    expect(log.trim()).toBe('workspace:default')
  })

  it('saves windows-specific worktree environment scripts as PowerShell files', async () => {
    const {
      getWorktreeEnvironment,
      saveWorktreeEnvironment
    } = await import('#~/services/worktree-environments.js')

    await saveWorktreeEnvironment('env-windows', {
      scripts: {
        'create.windows': 'Write-Output "create windows"',
        'start.windows': 'Write-Output "start windows"',
        'destroy.windows': 'Write-Output "destroy windows"'
      }
    })
    const environment = await getWorktreeEnvironment('env-windows')
    const createScript = environment.scripts.find(script => script.key === 'create.windows')

    expect(createScript).toMatchObject({
      platform: 'windows',
      fileName: 'create.windows.ps1',
      exists: true,
      content: 'Write-Output "create windows"\n'
    })
    await expect(
      readFile(path.join(primaryWorkspaceRoot, '.ai', 'env', 'env-windows', 'start.windows.ps1'), 'utf8')
    ).resolves.toBe('Write-Output "start windows"\n')
  })

  it('does not run shell base scripts as Windows worktree environment defaults', async () => {
    vi.doMock('node:process', async () => {
      const actual = await vi.importActual<typeof import('node:process')>('node:process')
      return {
        ...actual,
        platform: 'win32'
      }
    })
    const { runConfiguredWorktreeEnvironmentScripts } = await import('#~/services/worktree-environments.js')
    const environmentDir = path.join(primaryWorkspaceRoot, '.ai', 'env', 'env-windows-default')
    await mkdir(environmentDir, { recursive: true })
    await writeFile(path.join(environmentDir, 'create.sh'), 'exit 42\n', 'utf8')

    await expect(
      runConfiguredWorktreeEnvironmentScripts({
        operation: 'create',
        workspaceFolder: workspaceRoot,
        environmentId: 'env-windows-default'
      })
    ).resolves.toEqual([])
  })

  it('marks local worktree environments as user config and ignores them from git', async () => {
    const {
      getWorktreeEnvironment,
      saveWorktreeEnvironment
    } = await import('#~/services/worktree-environments.js')

    await saveWorktreeEnvironment(
      'env-private',
      {
        scripts: {
          create: 'printf "private\\n"'
        }
      },
      undefined,
      'user'
    )
    const environment = await getWorktreeEnvironment('env-private', undefined, 'user')
    const gitignore = await readFile(path.join(primaryWorkspaceRoot, '.gitignore'), 'utf8')

    expect(environment).toMatchObject({
      id: 'env-private',
      path: path.join(primaryWorkspaceRoot, '.ai', 'env.local', 'env-private'),
      source: 'user',
      isLocal: true
    })
    expect(gitignore.split(/\r?\n/)).toContain('.ai/env.local/')
  })

  it('uses an explicitly selected worktree environment when creating a managed worktree', async () => {
    const { provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Explicit Env', 'sess-explicit-env')

    const environmentDir = path.join(primaryWorkspaceRoot, '.ai', 'env', 'env-explicit')
    await mkdir(environmentDir, { recursive: true })
    await writeFile(
      path.join(environmentDir, getBaseScriptFileName('create')),
      buildScriptContent(
        'printf "%s\\n" "$VF_WORKTREE_ENV" > explicit-env.log\n',
        'Set-Content -Path explicit-env.log -Value "$($env:VF_WORKTREE_ENV)"\n'
      ),
      'utf8'
    )

    const workspace = await provisionSessionWorkspace('sess-explicit-env', {
      worktreeEnvironment: 'env-explicit'
    })
    const log = await readFile(path.join(workspace.workspaceFolder, 'explicit-env.log'), 'utf8')

    expect(workspace.worktreeEnvironment).toBe('env-explicit')
    expect(log.trim()).toBe('env-explicit')
  })

  it('runs configured destroy scripts when create scripts fail after creating a managed worktree', async () => {
    const { provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Create Fail Cleanup Env', 'sess-create-fail-cleanup')

    const environmentDir = path.join(primaryWorkspaceRoot, '.ai', 'env', 'env-create-fail-cleanup')
    const markerPath = path.join(primaryWorkspaceRoot, 'create-fail-destroy.log')
    await mkdir(environmentDir, { recursive: true })
    await writeFile(
      path.join(environmentDir, getBaseScriptFileName('create')),
      buildScriptContent(
        'printf "created\\n" > create-resource.log\nexit 17\n',
        'Set-Content -Path create-resource.log -Value "created"\nexit 17\n'
      ),
      'utf8'
    )
    await writeFile(
      path.join(environmentDir, getBaseScriptFileName('destroy')),
      buildScriptContent(
        `printf "%s:%s\\n" "$VF_WORKTREE_PATH" "$VF_WORKTREE_FORCE" > "${markerPath}"\n`,
        `Set-Content -Path "${markerPath}" -Value "$($env:VF_WORKTREE_PATH):$($env:VF_WORKTREE_FORCE)"\n`
      ),
      'utf8'
    )

    await expect(
      provisionSessionWorkspace('sess-create-fail-cleanup', {
        worktreeEnvironment: 'env-create-fail-cleanup'
      })
    ).rejects.toThrow('Worktree environment script failed')
    await expect(readFile(markerPath, 'utf8')).resolves.toBe(
      `${resolveExpectedManagedWorktreePath(primaryWorkspaceRoot, workspaceRoot, 'sess-create-fail-cleanup')}:true\n`
    )
  })

  it('runs configured worktree environment destroy scripts before removing a managed worktree', async () => {
    const { deleteSessionWorkspace, provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Destroy Env', 'sess-destroy-env')

    await writeFile(
      path.join(workspaceRoot, '.ai.config.json'),
      `${JSON.stringify({ conversation: { worktreeEnvironment: 'env-destroy' } }, null, 2)}\n`,
      'utf8'
    )
    const environmentDir = path.join(primaryWorkspaceRoot, '.ai', 'env', 'env-destroy')
    const markerPath = path.join(primaryWorkspaceRoot, 'destroy.log')
    await mkdir(environmentDir, { recursive: true })
    await writeFile(
      path.join(environmentDir, getBaseScriptFileName('destroy')),
      buildScriptContent(
        `printf "%s:%s\\n" "$VF_WORKTREE_PATH" "$VF_WORKTREE_FORCE" > "${markerPath}"\n`,
        `Set-Content -Path "${markerPath}" -Value "$($env:VF_WORKTREE_PATH):$($env:VF_WORKTREE_FORCE)"\n`
      ),
      'utf8'
    )

    const workspace = await provisionSessionWorkspace('sess-destroy-env')
    await deleteSessionWorkspace('sess-destroy-env', { force: true })
    const log = await readFile(markerPath, 'utf8')

    expect(log.trim()).toBe(`${workspace.worktreePath}:true`)
  })

  it('runs configured worktree environment start scripts for a workspace', async () => {
    const { runConfiguredWorktreeEnvironmentScripts } = await import('#~/services/worktree-environments.js')

    await writeFile(
      path.join(workspaceRoot, '.ai.config.json'),
      `${JSON.stringify({ conversation: { worktreeEnvironment: 'env-start' } }, null, 2)}\n`,
      'utf8'
    )
    const environmentDir = path.join(primaryWorkspaceRoot, '.ai', 'env', 'env-start')
    const markerPath = path.join(workspaceRoot, 'start.log')
    await mkdir(environmentDir, { recursive: true })
    await writeFile(
      path.join(environmentDir, getBaseScriptFileName('start')),
      buildScriptContent(
        `printf "%s:%s\\n" "$VF_SESSION_ID" "$VF_WORKTREE_OPERATION" > "${markerPath}"\n`,
        `Set-Content -Path "${markerPath}" -Value "$($env:VF_SESSION_ID):$($env:VF_WORKTREE_OPERATION)"\n`
      ),
      'utf8'
    )

    await runConfiguredWorktreeEnvironmentScripts({
      operation: 'start',
      workspaceFolder: workspaceRoot,
      sessionId: 'sess-start'
    })

    expect((await readFile(markerPath, 'utf8')).trim()).toBe('sess-start:start')
  })

  it('keeps the repo root directory name as the final segment when forking from an existing managed worktree', async () => {
    const { provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Parent', 'sess-parent')
    db.createSession('Child', 'sess-child')

    const parentWorkspace = await provisionSessionWorkspace('sess-parent')
    const childWorkspace = await provisionSessionWorkspace('sess-child', {
      sourceSessionId: 'sess-parent'
    })

    expect(path.basename(parentWorkspace.workspaceFolder)).toBe(path.basename(workspaceRoot))
    expect(path.basename(childWorkspace.workspaceFolder)).toBe(path.basename(workspaceRoot))
    expect(childWorkspace.workspaceFolder).toBe(
      resolveExpectedManagedWorktreePath(primaryWorkspaceRoot, workspaceRoot, 'sess-child')
    )
  })

  it('transfers a managed worktree to a retained local workspace without deleting files', async () => {
    const {
      provisionSessionWorkspace,
      transferSessionWorkspaceToLocal
    } = await import('#~/services/session/workspace.js')
    db.createSession('Managed', 'sess-local')

    const managedWorkspace = await provisionSessionWorkspace('sess-local')
    const transferredWorkspace = await transferSessionWorkspaceToLocal('sess-local')

    expect(transferredWorkspace).toMatchObject({
      sessionId: 'sess-local',
      kind: 'external_workspace',
      workspaceFolder: managedWorkspace.workspaceFolder,
      worktreePath: managedWorkspace.worktreePath,
      cleanupPolicy: 'retain',
      state: 'ready'
    })
  })

  it('refuses to delete a dirty managed worktree unless forced', async () => {
    const { deleteSessionWorkspace, provisionSessionWorkspace } = await import('#~/services/session/workspace.js')
    db.createSession('Dirty', 'sess-dirty')
    const workspace = await provisionSessionWorkspace('sess-dirty')

    await writeFile(path.join(workspace.workspaceFolder, 'dirty.txt'), 'dirty\n', 'utf8')

    await expect(deleteSessionWorkspace('sess-dirty')).rejects.toMatchObject({
      code: 'session_worktree_not_clean'
    })
  })
})
