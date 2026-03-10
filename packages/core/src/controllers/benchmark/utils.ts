import { spawn } from 'node:child_process'
import { access, mkdir, readFile, symlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

interface ExecCommandInput {
  command: string
  args?: string[]
  cwd: string
  env?: Record<string, string | null | undefined>
  timeoutMs?: number
  input?: string
}

export const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export const readTextIfExists = async (targetPath: string) => {
  if (!await pathExists(targetPath)) return null
  return readFile(targetPath, 'utf-8')
}

export const ensureParentDir = async (targetPath: string) => {
  await mkdir(dirname(targetPath), { recursive: true })
}

export const execCommand = async (input: ExecCommandInput): Promise<CommandResult> => {
  const startedAt = Date.now()
  const {
    command,
    args = [],
    cwd,
    env,
    timeoutMs,
    input: stdin
  } = input

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env
      },
      stdio: 'pipe'
    })

    const stdout: string[] = []
    const stderr: string[] = []
    let settled = false

    const finish = (value: CommandResult | Error, isError = false) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (isError) {
        reject(value)
        return
      }
      resolve(value as CommandResult)
    }

    child.stdout.on('data', (chunk) => {
      stdout.push(String(chunk))
    })
    child.stderr.on('data', (chunk) => {
      stderr.push(String(chunk))
    })
    child.on('error', (error) => {
      finish(error, true)
    })
    child.on('close', (code) => {
      finish({
        exitCode: code ?? -1,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        durationMs: Date.now() - startedAt
      })
    })

    const timer = timeoutMs != null
      ? setTimeout(() => {
          child.kill('SIGTERM')
        }, timeoutMs)
      : null

    if (stdin != null && stdin !== '') {
      child.stdin.write(stdin)
    }
    child.stdin.end()
  })
}

export const execShellCommand = async (input: Omit<ExecCommandInput, 'command' | 'args'> & { command: string }) => {
  const shell = process.env.SHELL || '/bin/sh'
  return execCommand({
    command: shell,
    args: ['-lc', input.command],
    cwd: input.cwd,
    env: input.env,
    timeoutMs: input.timeoutMs,
    input: input.input
  })
}

export const parseDiffFiles = (patch: string) => {
  const files = new Set<string>()
  const matcher = /^diff --git a\/(.+?) b\/(.+)$/gm
  for (const match of patch.matchAll(matcher)) {
    const [, oldPath, newPath] = match
    files.add(newPath === '/dev/null' ? oldPath : newPath)
  }
  return [...files]
}

export const summarizeText = (value: string, limit = 1200) => {
  const normalized = value.trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
}

export const linkPreparedNodeModules = async (sourceDir: string, targetDir: string) => {
  const candidates = ['node_modules']
  for (const name of candidates) {
    const sourcePath = join(sourceDir, name)
    const targetPath = join(targetDir, name)
    if (!await pathExists(sourcePath) || await pathExists(targetPath)) continue
    await symlink(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir')
  }
}
