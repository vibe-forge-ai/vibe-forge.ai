import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions, AdapterSession } from '@vibe-forge/types'

import { resolveCopilotBinaryPath } from '#~/paths.js'
import {
  DEFAULT_COPILOT_TOOLS,
  buildCopilotBaseArgs,
  buildCopilotChildEnv,
  getErrorMessage,
  resolveAdapterConfig,
  resolveCopilotModelConfig,
  toAdapterErrorData
} from '../shared'

export const createDirectCopilotSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const binaryPath = resolveCopilotBinaryPath(ctx.env, adapterConfig.cliPath, ctx.cwd, adapterConfig.cli)
  const prompt = options.description?.trim() !== '' ? options.description?.trim() : undefined
  const childEnv = await buildCopilotChildEnv(ctx, options, adapterConfig)
  const model = resolveCopilotModelConfig(ctx, options.model).cliModel ?? options.model ?? 'default'

  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model,
      effort: options.effort,
      version: 'unknown',
      tools: DEFAULT_COPILOT_TOOLS,
      slashCommands: [],
      cwd: ctx.cwd,
      agents: adapterConfig.agent ? [adapterConfig.agent] : [],
      assetDiagnostics: options.assetPlan?.diagnostics
    }
  })

  const proc = spawn(
    binaryPath,
    await buildCopilotBaseArgs({
      ctx,
      options,
      adapterConfig,
      prompt,
      interactive: true
    }),
    {
      cwd: ctx.cwd,
      env: childEnv,
      stdio: 'inherit'
    }
  )

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
      ctx.logger.warn('emit() is not supported in direct mode for copilot')
    },
    pid: proc.pid
  }
}
