import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions, AdapterSession } from '@vibe-forge/types'

import { resolveOpenCodeBinaryPath } from '../../paths'
import { buildOpenCodeRunArgs, buildOpenCodeSessionTitle, resolveOpenCodeAgent } from '../common'
import { buildChildEnv, ensureSystemPromptFile } from './child-env'
import { findOpenCodeSessionId } from './process'
import { getErrorMessage, resolveAdapterConfig, toAdapterErrorData } from './shared'

export const createDirectOpenCodeSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const agent = resolveOpenCodeAgent({
    agent: adapterConfig.agent,
    planAgent: adapterConfig.planAgent,
    permissionMode: options.permissionMode
  })
  const binaryPath = resolveOpenCodeBinaryPath(ctx.env)
  const title = buildOpenCodeSessionTitle(options.sessionId, adapterConfig.titlePrefix)
  const cachedSession = options.type === 'resume' ? await ctx.cache.get('adapter.opencode.session') : undefined
  const systemPromptFile = await ensureSystemPromptFile(ctx, options)
  const { cliModel, env } = await buildChildEnv({ ctx, options, adapterConfig, systemPromptFile })
  const opencodeSessionId = options.type === 'resume'
    ? await findOpenCodeSessionId({
      binaryPath,
      cwd: ctx.cwd,
      env,
      title,
      maxCount: adapterConfig.sessionListMaxCount ?? 50,
      logger: ctx.logger
    }) ?? cachedSession?.opencodeSessionId
    : undefined

  if (options.type === 'create') await ctx.cache.set('adapter.opencode.session', { title })

  const proc = spawn(
    binaryPath,
    buildOpenCodeRunArgs({
      prompt: options.description?.trim() !== '' ? options.description?.trim() : undefined,
      files: [],
      model: cliModel,
      agent,
      share: adapterConfig.share,
      title,
      dir: ctx.cwd,
      opencodeSessionId,
      extraOptions: options.extraOptions
    }),
    {
      cwd: ctx.cwd,
      env: env as Record<string, string>,
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
    void (async () => {
      if ((code ?? 0) === 0) {
        const resolvedSessionId = await findOpenCodeSessionId({
          binaryPath,
          cwd: ctx.cwd,
          env,
          title,
          maxCount: adapterConfig.sessionListMaxCount ?? 50,
          logger: ctx.logger
        })
        if (resolvedSessionId) {
          await ctx.cache.set('adapter.opencode.session', { opencodeSessionId: resolvedSessionId, title })
        }
      } else if (!didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: toAdapterErrorData(`Process exited with code ${code ?? 1}`, {
            details: { exitCode: code ?? 1 }
          })
        })
      }
      emitExitOnce({ exitCode: code ?? 0 })
    })()
  })

  return {
    kill: () => proc.kill(),
    emit: () => {
      ctx.logger.warn('emit() is not supported in direct mode for opencode')
    },
    pid: proc.pid
  }
}
