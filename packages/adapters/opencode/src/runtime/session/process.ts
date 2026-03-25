import { spawn } from 'node:child_process'

import type { AdapterCtx } from '@vibe-forge/core/adapter'

import { extractOpenCodeSessionRecords, selectOpenCodeSessionByTitle } from '../common'
import { execFileAsync, type OpenCodeRunResult } from './shared'

export const findOpenCodeSessionId = async (params: {
  binaryPath: string
  cwd: string
  env: Record<string, string | null | undefined>
  title: string
  maxCount: number
  logger: AdapterCtx['logger']
}) => {
  try {
    const { stdout } = await execFileAsync(
      params.binaryPath,
      ['session', 'list', '--format', 'json', '--max-count', String(params.maxCount)],
      { cwd: params.cwd, env: params.env as Record<string, string>, maxBuffer: 1024 * 1024 * 8 }
    )
    return selectOpenCodeSessionByTitle(extractOpenCodeSessionRecords(stdout), params.title)?.id
  } catch (err) {
    params.logger.debug('Failed to resolve OpenCode session id from session list', { err })
    return undefined
  }
}

export const runOpenCodeCommand = (params: {
  binaryPath: string
  args: string[]
  cwd: string
  env: Record<string, string | null | undefined>
  onStart?: (pid?: number) => void
}) => new Promise<OpenCodeRunResult>((resolveResult, reject) => {
  const proc = spawn(params.binaryPath, params.args, {
    cwd: params.cwd,
    env: params.env as Record<string, string>,
    stdio: 'pipe'
  })

  params.onStart?.(proc.pid)
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  proc.stdout.on('data', chunk => stdoutChunks.push(String(chunk)))
  proc.stderr.on('data', chunk => stderrChunks.push(String(chunk)))
  proc.on('error', reject)
  proc.on('exit', code => {
    resolveResult({
      exitCode: code ?? 0,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join('')
    })
  })
})
