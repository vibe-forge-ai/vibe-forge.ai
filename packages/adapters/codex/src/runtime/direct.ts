import { spawn } from 'node:child_process'

import type { AdapterQueryOptions } from '@vibe-forge/types'
import type { CodexSessionBase } from './session-common'

import { buildFeatureArgs, toCodexOutboundApprovalPolicy } from './session-common'

/**
 * Spawn `codex [prompt?]` or `codex resume [SESSION_ID|--last] [prompt?]` with
 * `stdio: 'inherit'`, handing the terminal directly to the user.
 * `emit()` is a no-op in this mode.
 */
export function createDirectCodexSession(base: CodexSessionBase, options: AdapterQueryOptions) {
  const {
    logger,
    cwd,
    binaryPath,
    spawnEnv,
    useYolo,
    approvalPolicy,
    sandboxPolicy,
    features,
    configOverrideArgs,
    resolvedModel,
    cachedThreadId
  } = base
  const { onEvent, description, extraOptions, type: sessionType } = options

  const isResume = sessionType === 'resume'
  const approvalFlag = toCodexOutboundApprovalPolicy(approvalPolicy)

  const args: string[] = []

  if (useYolo) {
    args.push('--yolo')
  }
  if (isResume) {
    args.push('resume')
  }
  args.push(...configOverrideArgs)

  if (resolvedModel) {
    args.push('--model', resolvedModel)
  }

  const sandboxFlag = sandboxPolicy.type === 'workspaceWrite'
    ? 'workspace-write'
    : sandboxPolicy.type === 'readOnly'
    ? 'read-only'
    : sandboxPolicy.type === 'dangerFullAccess'
    ? 'danger-full-access'
    : undefined
  if (!useYolo && sandboxFlag) {
    args.push('--sandbox', sandboxFlag)
  }

  if (!useYolo) {
    args.push('--ask-for-approval', approvalFlag)
  }
  args.push(...buildFeatureArgs(features))

  if (extraOptions?.length) {
    args.push(...extraOptions)
  }

  if (isResume) {
    if (cachedThreadId) {
      args.push(cachedThreadId)
    } else {
      args.push('--last')
    }
  }

  if (description) {
    args.push(description)
  }

  logger.info('[codex session] spawning CLI (direct mode)', { binaryPath, args, cwd })

  const proc = spawn(String(binaryPath), args, { env: spawnEnv, cwd, stdio: 'inherit' })
  let didEmitExit = false

  const emitExit = (data: { exitCode?: number; stderr?: string }) => {
    if (didEmitExit) return
    didEmitExit = true
    onEvent({ type: 'exit', data })
  }

  proc.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err)
    onEvent({
      type: 'error',
      data: {
        message,
        details: err,
        fatal: true
      }
    })
    emitExit({ exitCode: 1, stderr: message })
  })

  proc.on('exit', (code) => {
    if ((code ?? 0) !== 0) {
      onEvent({
        type: 'error',
        data: {
          message: `Process exited with code ${code ?? 1}`,
          details: { exitCode: code ?? 1 },
          fatal: true
        }
      })
    }
    emitExit({ exitCode: code ?? undefined })
  })

  return {
    kill: () => proc.kill(),
    emit: () => {
      logger.warn('[codex session] emit() is not supported in direct mode')
    },
    pid: proc.pid
  }
}
