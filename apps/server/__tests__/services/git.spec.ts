import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  execFile: vi.fn(),
  getDb: vi.fn(),
  getWorkspaceFolder: vi.fn()
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

vi.mock('#~/services/config/index.js', () => ({
  getWorkspaceFolder: mocks.getWorkspaceFolder
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
    mocks.getWorkspaceFolder.mockReturnValue('/workspace')
    mocks.getDb.mockReturnValue({
      getSession: vi.fn(() => ({
        id: 'sess-1'
      })),
      getMessages: vi.fn(() => [
        {
          type: 'session_info',
          info: {
            type: 'init',
            cwd: '/workspace/packages/app'
          }
        }
      ])
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
      { stdout: '2\t1\tsrc/other.ts\n' },
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

  it('creates a tracking branch when switching to a remote branch without a local peer', async () => {
    mockExecResponses(
      { stdout: '/workspace\n' },
      { stdout: '# branch.head main\n' },
      {
        stdout: [
          'main\trefs/heads/main',
          'origin/main\trefs/remotes/origin/main',
          'origin/feature/header\trefs/remotes/origin/feature/header'
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
