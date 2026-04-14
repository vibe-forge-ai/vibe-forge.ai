import { execFile } from 'node:child_process'

export interface GitCommandError extends Error {
  code?: number | string | null
  stderr?: string
  stdout?: string
}

const GIT_MAX_BUFFER = 1024 * 1024

export const resolveGitErrorMessage = (error: unknown, fallback: string) => {
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

export const isGitMissingError = (error: unknown) => {
  return error instanceof Error && (error as GitCommandError).code === 'ENOENT'
}

export const isNotRepositoryError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const gitError = error as GitCommandError
  const stderr = gitError.stderr ?? ''
  return gitError.code === 128 && /not a git repository/i.test(stderr)
}

export const runGit = async (args: string[], cwd: string) => {
  try {
    const result = await new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
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

          resolvePromise({ stdout, stderr })
        }
      )
    })

    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim()
    }
  } catch (error) {
    const gitError = error as GitCommandError
    const wrappedError = Object.assign(new Error(resolveGitErrorMessage(error, `git ${args.join(' ')} failed`)), {
      ...gitError,
      stdout: gitError.stdout ?? '',
      stderr: gitError.stderr ?? ''
    }) as GitCommandError

    throw wrappedError
  }
}
