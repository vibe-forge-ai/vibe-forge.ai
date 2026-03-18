import { spawn } from 'node:child_process'

import type { AdapterQueryOptions } from '@vibe-forge/core/adapter'
import type { CodexSessionBase } from './session-common'

import {
  buildFeatureArgs,
  toCodexOutboundApprovalPolicy
} from './session-common'

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

  const args: string[] = isResume
    ? ['resume', ...configOverrideArgs]
    : [...configOverrideArgs]

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
  if (sandboxFlag) {
    args.push('--sandbox', sandboxFlag)
  }

  args.push('--ask-for-approval', approvalFlag)
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

  proc.on('exit', (code) => {
    onEvent({ type: 'exit', data: { exitCode: code ?? undefined } })
  })

  return {
    kill: () => proc.kill(),
    emit: () => {
      logger.warn('[codex session] emit() is not supported in direct mode')
    },
    pid: proc.pid
  }
}
