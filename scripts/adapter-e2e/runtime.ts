import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import type { RunProcessOptions, RunProcessResult } from './types'

export const repoRoot = process.cwd()
export const cliPath = path.resolve(repoRoot, 'apps/cli/cli.js')
export const cliPackageDir = path.resolve(repoRoot, 'apps/cli')
export const opencodeBin = path.resolve(
  repoRoot,
  'packages/adapters/opencode/node_modules/.bin/opencode'
)
export const mockHome = path.resolve(repoRoot, '.ai/.mock')
export const realHome = process.env.HOME ?? ''
export const mockModelService = 'hook-smoke-mock'
export const mockClaudeService = 'hook-smoke-mock-ccr'
export const isDebugEnabled = process.env.HOOK_SMOKE_DEBUG === '1'

export const createCtxId = (adapter: string) => (
  process.env.HOOK_SMOKE_CTX_ID?.trim() || `hooks-smoke-${adapter}-${Date.now()}`
)

export const createSessionId = () => (
  process.env.HOOK_SMOKE_SESSION_ID?.trim() || randomUUID()
)

export const toProviderModel = (model: string) => {
  if (!model.includes(',')) return model
  const [providerId, modelId] = model.split(',', 2)
  return `${providerId}/${modelId}`
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export const waitForPath = async (targetPath: string, timeoutMs = 5_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await pathExists(targetPath)) return true
    await sleep(200)
  }
  return false
}

const killProcessTree = (pid: number | undefined, signal: NodeJS.Signals) => {
  if (pid == null) return

  try {
    if (process.platform !== 'win32') {
      process.kill(-pid, signal)
      return
    }
  } catch {
  }

  try {
    process.kill(pid, signal)
  } catch {
  }
}

export const runProcess = async ({
  command,
  args,
  env,
  timeoutMs,
  passthroughStdIO = true
}: RunProcessOptions): Promise<RunProcessResult> => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  let timedOut = false
  let forceKillTimer: NodeJS.Timeout | undefined

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutChunks.push(chunk)
    if (passthroughStdIO) process.stdout.write(chunk)
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderrChunks.push(chunk)
    if (passthroughStdIO) process.stderr.write(chunk)
  })

  const timeout = timeoutMs != null
    ? setTimeout(() => {
      timedOut = true
      killProcessTree(child.pid ?? undefined, 'SIGTERM')
      forceKillTimer = setTimeout(() => {
        killProcessTree(child.pid ?? undefined, 'SIGKILL')
      }, 5_000)
    }, timeoutMs)
    : undefined

  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (timeout != null) clearTimeout(timeout)
      if (forceKillTimer != null) clearTimeout(forceKillTimer)
      resolve({
        code: code ?? (timedOut ? -1 : 0),
        signal,
        timedOut,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8')
      })
    })
  })
}

export const buildBaseEnv = (ctxId: string, mockServerPort: number): NodeJS.ProcessEnv => ({
  ...process.env,
  __VF_PROJECT_AI_CTX_ID__: ctxId,
  __VF_PROJECT_WORKSPACE_FOLDER__: repoRoot,
  HOOK_SMOKE_MOCK_PORT: String(mockServerPort)
})
