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
          '? README.md'
        ].join('\n')
      },
      { stdout: 'origin\nupstream\n' }
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
      hasUnstagedChanges: false,
      hasUntrackedChanges: true,
      remotes: ['origin', 'upstream']
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
      { stdout: '# branch.head feature/header\n' },
      { stdout: 'origin\n' }
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
})
