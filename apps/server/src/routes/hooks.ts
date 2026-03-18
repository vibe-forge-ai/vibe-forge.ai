import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import Router from '@koa/router'

import { badRequest, internalServerError } from '#~/utils/http.js'

type AllowedHookEventName =
  | 'StartTasks'
  | 'TaskStart'
  | 'TaskStop'
  | 'GenerateSystemPrompt'

const allowedHookEventNames = new Set<AllowedHookEventName>([
  'StartTasks',
  'TaskStart',
  'TaskStop',
  'GenerateSystemPrompt'
])

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const pickHookEnv = (env: Record<string, unknown>): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(env)) {
    if (typeof val === 'string') {
      result[key] = val
    }
  }
  return result
}

const resolveWorkspaceRoot = (cliPackageDir: string) => {
  return path.resolve(cliPackageDir, '../..')
}

const resolveCallHookJs = () => {
  const cliPkgJsonPath = require.resolve('@vibe-forge/cli/package.json')
  return {
    cliPackageDir: path.dirname(cliPkgJsonPath),
    callHookJsPath: path.resolve(path.dirname(cliPkgJsonPath), 'call-hook.js')
  }
}

const callHook = async (params: {
  hookEventName: AllowedHookEventName
  input: Record<string, unknown>
  env?: Record<string, unknown>
}) => {
  const { cliPackageDir, callHookJsPath } = resolveCallHookJs()
  const workspaceRoot = resolveWorkspaceRoot(cliPackageDir)

  const cwd = typeof params.input.cwd === 'string' ? params.input.cwd : workspaceRoot
  const sessionId = typeof params.input.sessionId === 'string' ? params.input.sessionId : ''
  const hookInput = {
    ...params.input,
    cwd,
    sessionId,
    hookEventName: params.hookEventName
  }

  const childEnv: NodeJS.ProcessEnv = params.env
    ? pickHookEnv(params.env)
    : process.env

  const child = spawn(process.execPath, [callHookJsPath], {
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  child.stdout.on('data', chunk => stdoutChunks.push(chunk))
  child.stderr.on('data', chunk => stderrChunks.push(chunk))

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 0))
    child.stdin.end(JSON.stringify(hookInput))
  })

  const stdout = Buffer.concat(stdoutChunks).toString('utf-8')
  const stderr = Buffer.concat(stderrChunks).toString('utf-8')

  let output: unknown
  try {
    output = stdout ? JSON.parse(stdout) : undefined
  } catch {
    output = stdout
  }

  return {
    exitCode,
    stdout,
    stderr,
    output
  }
}

export function hooksRouter(): Router {
  const router = new Router()

  router.post('/call', async (ctx) => {
    if (!isRecord(ctx.request.body)) {
      throw badRequest('Invalid body', undefined, 'invalid_body')
    }

    const hookEventNameRaw = ctx.request.body.hookEventName
    const inputRaw = ctx.request.body.input
    const envRaw = ctx.request.body.env

    if (typeof hookEventNameRaw !== 'string' || !allowedHookEventNames.has(hookEventNameRaw as AllowedHookEventName)) {
      throw badRequest('Invalid hookEventName', { hookEventName: hookEventNameRaw }, 'invalid_hook_event_name')
    }
    if (!isRecord(inputRaw)) {
      throw badRequest('Invalid input', undefined, 'invalid_input')
    }

    const sessionId = typeof inputRaw.sessionId === 'string' ? inputRaw.sessionId : ''
    if (!sessionId) {
      throw badRequest('Missing sessionId', undefined, 'missing_session_id')
    }

    try {
      const result = await callHook({
        hookEventName: hookEventNameRaw as AllowedHookEventName,
        input: inputRaw,
        env: isRecord(envRaw) ? envRaw : undefined
      })
      ctx.body = { ok: true, ...result }
    } catch (e) {
      throw internalServerError(`Failed to call hook: ${String(e)}`, { cause: e, code: 'hook_call_failed' })
    }
  })

  return router
}
