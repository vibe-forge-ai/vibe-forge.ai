import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions, AdapterSession } from '@vibe-forge/types'

import { getErrorMessage, toAdapterErrorData } from './common'
import { hasStoredKimiSessionState, resolveKimiSessionBase } from './config'

export const createDirectKimiSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => {
  const base = await resolveKimiSessionBase(ctx, options)
  const shouldContinue = options.type === 'resume' && hasStoredKimiSessionState(base.shareDir)

  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model: base.reportedModel ?? base.cliModel ?? options.model ?? 'default',
      effort: options.effort,
      version: 'unknown',
      tools: base.toolNames,
      slashCommands: [],
      cwd: ctx.cwd,
      agents: base.reportedAgent != null ? [base.reportedAgent] : []
    }
  })

  const args = [
    ...base.turnArgPrefix,
    ...(options.permissionMode === 'bypassPermissions' ? ['--yolo'] : []),
    ...(options.permissionMode === 'plan' ? ['--plan'] : []),
    ...(shouldContinue ? ['--continue'] : []),
    ...(options.description != null && options.description.trim() !== ''
      ? ['--prompt', options.description.trim()]
      : [])
  ]
  const proc = spawn(base.binaryPath, args, {
    cwd: ctx.cwd,
    env: base.spawnEnv,
    stdio: 'inherit'
  })

  let finished = false
  let didEmitFatalError = false
  const emitEvent = (event: AdapterOutputEvent) => {
    if (event.type === 'error' && event.data.fatal !== false) {
      didEmitFatalError = true
    }
    options.onEvent(event)
  }
  const emitExitOnce = (data: { exitCode: number; stderr?: string }) => {
    if (finished) return
    finished = true
    emitEvent({ type: 'exit', data })
  }

  proc.on('error', (error) => {
    emitEvent({ type: 'error', data: toAdapterErrorData(error) })
    emitExitOnce({ exitCode: 1, stderr: getErrorMessage(error) })
  })
  proc.on('exit', (code) => {
    if ((code ?? 0) !== 0 && !didEmitFatalError) {
      emitEvent({
        type: 'error',
        data: toAdapterErrorData(`Process exited with code ${code ?? 1}`, {
          details: { exitCode: code ?? 1 }
        })
      })
    }
    emitExitOnce({ exitCode: code ?? 0 })
  })

  return {
    kill: () => proc.kill(),
    emit: () => {
      ctx.logger.warn('emit() is not supported in direct mode for kimi')
    },
    pid: proc.pid
  }
}
