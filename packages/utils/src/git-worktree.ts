import { execFile } from 'node:child_process'

export interface GitCommandError extends Error {
  code?: number | string | null
  stderr?: string
  stdout?: string
}

interface RunGitResult {
  stdout: string
  stderr: string
}

interface AddGitWorktreeOptions {
  branch?: string
  cwd: string
  path: string
  ref?: string
  detach?: boolean
  force?: boolean
}

interface RemoveGitWorktreeOptions {
  cwd: string
  path: string
  force?: boolean
}

const GIT_MAX_BUFFER = 1024 * 1024

const normalizeOutput = (value: string) => value.trim()

const formatGitErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    const gitError = error as GitCommandError
    if (typeof gitError.stderr === 'string' && gitError.stderr.trim() !== '') {
      return gitError.stderr.trim()
    }
    if (typeof gitError.stdout === 'string' && gitError.stdout.trim() !== '') {
      return gitError.stdout.trim()
    }
    if (gitError.message.trim() !== '') {
      return gitError.message.trim()
    }
  }

  return fallback
}

export const isGitMissingError = (error: unknown) => (
  error instanceof Error && (error as GitCommandError).code === 'ENOENT'
)

export const isGitNotRepositoryError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const gitError = error as GitCommandError
  const stderr = gitError.stderr ?? ''
  return gitError.code === 128 && /not a git repository/i.test(stderr)
}

export const runGitCommand = async (args: string[], cwd: string): Promise<RunGitResult> => {
  try {
    const result = await new Promise<RunGitResult>((resolvePromise, reject) => {
      execFile(
        'git',
        args,
        {
          cwd,
          maxBuffer: GIT_MAX_BUFFER
        },
        (error, stdout, stderr) => {
          if (error != null) {
            reject(Object.assign(error, { stdout, stderr }))
            return
          }

          resolvePromise({
            stdout: normalizeOutput(stdout),
            stderr: normalizeOutput(stderr)
          })
        }
      )
    })

    return result
  } catch (error) {
    const gitError = error as GitCommandError
    const enhancedError = Object.assign(new Error(formatGitErrorMessage(error, `git ${args.join(' ')} failed`)), {
      ...gitError,
      stdout: gitError.stdout ?? '',
      stderr: gitError.stderr ?? ''
    }) as GitCommandError
    throw enhancedError
  }
}

export const resolveGitRepositoryRoot = async (cwd: string) => {
  const { stdout } = await runGitCommand(['rev-parse', '--show-toplevel'], cwd)
  return stdout
}

export const resolveGitHeadRef = async (cwd: string) => {
  const { stdout } = await runGitCommand(['rev-parse', 'HEAD'], cwd)
  return stdout
}

export const resolveGitCurrentBranch = async (cwd: string) => {
  const { stdout } = await runGitCommand(['branch', '--show-current'], cwd)
  return stdout
}

export const addGitWorktree = async (options: AddGitWorktreeOptions) => {
  const args = ['worktree', 'add']
  if (options.force !== false) {
    args.push('--force')
  }
  if (options.branch != null && options.branch.trim() !== '') {
    args.push('-b', options.branch.trim())
  } else if (options.detach !== false) {
    args.push('--detach')
  }
  args.push(options.path, options.ref?.trim() || 'HEAD')
  await runGitCommand(args, options.cwd)
}

export const removeGitWorktree = async (options: RemoveGitWorktreeOptions) => {
  const args = ['worktree', 'remove']
  if (options.force !== false) {
    args.push('--force')
  }
  args.push(options.path)
  await runGitCommand(args, options.cwd)
}
