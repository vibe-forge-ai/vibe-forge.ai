import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
    const currentBranch = execFileSync('git', ['branch', '--show-current'], {
      cwd: workspace.workspaceFolder,
      encoding: 'utf8'
    }).trim()

    expect(workspace).toMatchObject({
      sessionId: 'sess-1',
      kind: 'managed_worktree',
      workspaceFolder: path.join(primaryWorkspaceRoot, '.ai', 'worktrees', 'sessions', 'sess-1'),
      repositoryRoot: path.join(primaryWorkspaceRoot, '.ai', 'worktrees', 'sessions', 'sess-1'),
      worktreePath: path.join(primaryWorkspaceRoot, '.ai', 'worktrees', 'sessions', 'sess-1'),
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

    expect(managedWorkspace).toMatchObject({
      sessionId: 'sess-shared',
      kind: 'managed_worktree',
      workspaceFolder: path.join(primaryWorkspaceRoot, '.ai', 'worktrees', 'sessions', 'sess-shared'),
      worktreePath: path.join(primaryWorkspaceRoot, '.ai', 'worktrees', 'sessions', 'sess-shared'),
      cleanupPolicy: 'delete_on_session_delete',
      state: 'ready'
    })
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
