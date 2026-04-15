import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  execFile: vi.fn(),
  getDb: vi.fn(),
  resolveSessionWorkspaceFolder: vi.fn()
}))

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile
}))

vi.mock('node:fs/promises', () => ({
  access: mocks.access
}))

vi.mock('#~/db/index.js', () => ({
  getDb: mocks.getDb
}))

vi.mock('#~/services/session/workspace.js', () => ({
  resolveSessionWorkspaceFolder: mocks.resolveSessionWorkspaceFolder
}))

const mockExecResponses = (...responses: Array<{ stdout?: string; stderr?: string } | Error>) => {
  mocks.execFile.mockImplementation(
    ((...args: any[]) => {
      const callback = args.at(-1) as ((error: Error | null, stdout: string, stderr: string) => void) | undefined
      const next = responses.shift()
      queueMicrotask(() => {
        if (next instanceof Error) {
          callback?.(next, (next as any).stdout ?? '', (next as any).stderr ?? '')
          return
        }

        callback?.(null, next?.stdout ?? '', next?.stderr ?? '')
      })
      return {} as any
    }) as any
  )
}

const createExecError = (message: string, options?: { code?: number | string; stderr?: string; stdout?: string }) => {
  return Object.assign(new Error(message), {
    code: options?.code,
    stderr: options?.stderr ?? '',
    stdout: options?.stdout ?? ''
  })
}

describe('git service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.access.mockResolvedValue(undefined)
    mocks.resolveSessionWorkspaceFolder.mockResolvedValue('/workspace/packages/app')
    mocks.getDb.mockReturnValue({
      getSession: vi.fn(() => ({
        id: 'sess-1'
      })),
      getMessages: vi.fn(() => [])
    })
  })

  it('returns unavailable when the session cwd is not a git repository', async () => {
    mockExecResponses(
      createExecError('not a repo', {
        code: 128,
        stderr: 'fatal: not a git repository (or any of the parent directories): .git'
      })
    )

    const { getSessionGitState } = await import('#~/services/git/index.js')
    await expect(getSessionGitState('sess-1')).resolves.toEqual({
      available: false,
      cwd: '/workspace/packages/app',
      reason: 'not_repository'
    })
  })

  it('parses git repository state and remote list', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head feature/header',
          '# branch.upstream origin/feature/header',
          '# branch.ab +2 -1',
          '1 M. N... 100644 100644 100644 123456 123456 src/app.ts',
          '1 .M N... 100644 100644 100644 123456 123456 src/other.ts',
          '? README.md'
        ].join('\n')
      },
      { stdout: 'origin\nupstream\n' },
      { stdout: '10\t0\tsrc/app.ts\n' },
      { stdout: '10\t0\tsrc/app.ts\n2\t1\tsrc/other.ts\n' },
      { stdout: 'README.md\0' },
      { stdout: '1234567890abcdef\tfeat: header polish' }
    )

    const { getSessionGitState } = await import('#~/services/git/index.js')
    await expect(getSessionGitState('sess-1')).resolves.toEqual({
      available: true,
      cwd: '/workspace/packages/app',
      repositoryRoot: '/workspace',
      currentBranch: 'feature/header',
      upstream: 'origin/feature/header',
      ahead: 2,
      behind: 1,
      hasChanges: true,
      hasStagedChanges: true,
      hasUnstagedChanges: true,
      hasUntrackedChanges: true,
      remotes: ['origin', 'upstream'],
      stagedSummary: {
        changedFiles: 1,
        additions: 10,
        deletions: 0
      },
      workingTreeSummary: {
        changedFiles: 3,
        additions: 12,
        deletions: 1
      },
      headCommit: {
        hash: '1234567890abcdef',
        shortHash: '1234567',
        subject: 'feat: header polish'
      }
    })
  })

  it('does not double count files that have both staged and unstaged changes', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head feature/header',
          '# branch.upstream origin/feature/header',
          '1 MM N... 100644 100644 100644 123456 123456 src/app.ts'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '1\t1\tsrc/app.ts\n' },
      { stdout: '1\t1\tsrc/app.ts\n' },
      { stdout: '' },
      { stdout: '1234567890abcdef\tfeat: header polish' }
    )

    const { getSessionGitState } = await import('#~/services/git/index.js')
    await expect(getSessionGitState('sess-1')).resolves.toMatchObject({
      available: true,
      stagedSummary: {
        changedFiles: 1,
        additions: 1,
        deletions: 1
      },
      workingTreeSummary: {
        changedFiles: 1,
        additions: 1,
        deletions: 1
      }
    })
  })

  it('falls back to the empty tree when HEAD is missing', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head main',
          '1 A. N... 100644 100644 100644 123456 123456 src/app.ts',
          '? README.md'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '3\t0\tsrc/app.ts\n' },
      createExecError("fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.", {
        code: 128,
        stderr: "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree."
      }),
      { stdout: 'README.md\0' },
      createExecError("fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.", {
        code: 128,
        stderr: "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree."
      }),
      { stdout: '3\t0\tsrc/app.ts\n' }
    )

    const { getSessionGitState } = await import('#~/services/git/index.js')
    await expect(getSessionGitState('sess-1')).resolves.toEqual({
      available: true,
      cwd: '/workspace/packages/app',
      repositoryRoot: '/workspace',
      currentBranch: 'main',
      upstream: null,
      ahead: 0,
      behind: 0,
      hasChanges: true,
      hasStagedChanges: true,
      hasUnstagedChanges: false,
      hasUntrackedChanges: true,
      remotes: ['origin'],
      stagedSummary: {
        changedFiles: 1,
        additions: 3,
        deletions: 0
      },
      workingTreeSummary: {
        changedFiles: 2,
        additions: 3,
        deletions: 0
      },
      headCommit: null
    })

    expect(mocks.execFile).toHaveBeenCalledWith(
      'git',
      ['diff', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '--numstat'],
      expect.objectContaining({
        cwd: '/workspace',
        maxBuffer: 1048576
      }),
      expect.any(Function)
    )
  })

  it('creates a tracking branch when switching to a remote branch without a local peer', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      { stdout: '# branch.head main\n' },
      {
        stdout: [
          'main\trefs/heads/main\t/workspace',
          'origin/main\trefs/remotes/origin/main\t',
          'origin/feature/header\trefs/remotes/origin/feature/header\t'
        ].join('\n')
      },
      { stdout: '' },
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head feature/header',
          '# branch.upstream origin/feature/header'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '' },
      { stdout: '' },
      { stdout: '' },
      { stdout: 'abcdef0123456789\tfeat: base' }
    )

    const { checkoutSessionGitBranch } = await import('#~/services/git/index.js')
    const result = await checkoutSessionGitBranch('sess-1', {
      name: 'origin/feature/header',
      kind: 'remote'
    })

    expect(result.currentBranch).toBe('feature/header')
    expect(mocks.execFile).toHaveBeenCalledWith(
      'git',
      ['checkout', '--track', 'origin/feature/header'],
      expect.objectContaining({
        cwd: '/workspace',
        maxBuffer: 1048576
      }),
      expect.any(Function)
    )
  })

  it('rejects switching to a branch that is already checked out in another worktree', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      { stdout: '# branch.head feature/current\n' },
      {
        stdout: [
          'feature/current\trefs/heads/feature/current\t/workspace',
          'main\trefs/heads/main\t/Users/yijie/codes/vibe-forge.ai',
          'origin/main\trefs/remotes/origin/main\t'
        ].join('\n')
      }
    )

    const { checkoutSessionGitBranch } = await import('#~/services/git/index.js')
    await expect(checkoutSessionGitBranch('sess-1', {
      name: 'origin/main',
      kind: 'remote'
    })).rejects.toMatchObject({
      code: 'git_branch_checked_out_in_other_worktree',
      status: 409,
      details: {
        branchName: 'main',
        kind: 'remote',
        name: 'origin/main',
        worktreePath: '/Users/yijie/codes/vibe-forge.ai'
      }
    })

    expect(mocks.execFile).not.toHaveBeenCalledWith(
      'git',
      ['checkout', 'main'],
      expect.anything(),
      expect.any(Function)
    )
  })

  it('lists git worktrees for the current repository', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      {
        stdout: [
          'worktree /workspace',
          'HEAD abcdef0123456789',
          'branch refs/heads/main',
          '',
          'worktree /Users/yijie/.codex/worktrees/3d03/vibe-forge.ai',
          'HEAD bcdef0123456789a',
          'branch refs/heads/feature/header',
          '',
          'worktree /tmp/detached-tree',
          'HEAD cdef0123456789ab',
          'detached'
        ].join('\n')
      }
    )

    const { listSessionGitWorktrees } = await import('#~/services/git/index.js')
    await expect(listSessionGitWorktrees('sess-1')).resolves.toEqual({
      worktrees: [
        {
          path: '/workspace',
          branchName: 'main',
          isCurrent: true,
          isDetached: false
        },
        {
          path: '/Users/yijie/.codex/worktrees/3d03/vibe-forge.ai',
          branchName: 'feature/header',
          isCurrent: false,
          isDetached: false
        },
        {
          path: '/tmp/detached-tree',
          branchName: null,
          isCurrent: false,
          isDetached: true
        }
      ]
    })
  })

  it('amends the latest commit message without staging unstaged changes and skips hooks', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head main',
          '# branch.upstream origin/main'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '' },
      { stdout: '' },
      { stdout: '' },
      { stdout: 'abcdef0123456789\tfeat: latest commit' },
      { stdout: '' },
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head main',
          '# branch.upstream origin/main'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '' },
      { stdout: '' },
      { stdout: '' },
      { stdout: 'abcdef0123456789\tfeat: latest commit' }
    )

    const { commitSessionGitChanges } = await import('#~/services/git/index.js')
    await expect(commitSessionGitChanges('sess-1', {
      amend: true,
      includeUnstagedChanges: false,
      message: 'feat: latest commit (edited)',
      skipHooks: true
    })).resolves.toMatchObject({
      available: true
    })

    expect(mocks.execFile).toHaveBeenCalledWith(
      'git',
      ['commit', '--amend', '--no-verify', '-m', 'feat: latest commit (edited)'],
      expect.objectContaining({
        cwd: '/workspace',
        maxBuffer: 1048576
      }),
      expect.any(Function)
    )
    expect(mocks.execFile).not.toHaveBeenCalledWith(
      'git',
      ['add', '-A'],
      expect.anything(),
      expect.any(Function)
    )
  })

  it('rejects no-op amend when there are no changes and no new message', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head main',
          '# branch.upstream origin/main'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '' },
      { stdout: '' },
      { stdout: '' },
      { stdout: 'abcdef0123456789\tfeat: latest commit' }
    )

    const { commitSessionGitChanges } = await import('#~/services/git/index.js')
    await expect(commitSessionGitChanges('sess-1', {
      amend: true,
      includeUnstagedChanges: false
    })).rejects.toMatchObject({
      code: 'git_no_changes_to_commit',
      status: 409
    })

    expect(mocks.execFile).not.toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['commit']),
      expect.anything(),
      expect.any(Function)
    )
  })

  it('force pushes with --force-with-lease when requested', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head main',
          '# branch.upstream origin/main',
          '# branch.ab +1 -0'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '' },
      { stdout: '' },
      { stdout: '' },
      { stdout: 'abcdef0123456789\tfeat: latest commit' },
      { stdout: '' },
      { stdout: '/workspace\n' },
      {
        stdout: [
          '# branch.head main',
          '# branch.upstream origin/main'
        ].join('\n')
      },
      { stdout: 'origin\n' },
      { stdout: '' },
      { stdout: '' },
      { stdout: '' },
      { stdout: 'abcdef0123456789\tfeat: latest commit' }
    )

    const { pushSessionGitBranch } = await import('#~/services/git/index.js')
    await expect(pushSessionGitBranch('sess-1', { force: true })).resolves.toMatchObject({
      available: true
    })

    expect(mocks.execFile).toHaveBeenCalledWith(
      'git',
      ['push', '--force-with-lease'],
      expect.objectContaining({
        cwd: '/workspace',
        maxBuffer: 1048576
      }),
      expect.any(Function)
    )
  })
})
