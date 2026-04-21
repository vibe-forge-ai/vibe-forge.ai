import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions, AdapterSession } from '@vibe-forge/types'

import { resolveOpenCodeBinaryPath } from '../../paths'
import {
  DEFAULT_OPENCODE_TOOLS,
  buildOpenCodeRunArgs,
  buildOpenCodeSessionTitle,
  resolveOpenCodeAgent
} from '../common'
import { buildChildEnv, ensureSystemPromptFile } from './child-env'
import { findOpenCodeSessionId } from './process'
import { getErrorMessage, resolveAdapterConfig, toAdapterErrorData } from './shared'

export const createDirectOpenCodeSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const agent = resolveOpenCodeAgent({
    agent: adapterConfig.native.agent,
    planAgent: adapterConfig.native.planAgent,
    permissionMode: options.permissionMode
  })
  const binaryPath = resolveOpenCodeBinaryPath(ctx.env, ctx.cwd, adapterConfig.native.cli)
  const title = buildOpenCodeSessionTitle(options.sessionId, adapterConfig.native.titlePrefix)
  const cachedSession = options.type === 'resume' ? await ctx.cache.get('adapter.opencode.session') : undefined
  const systemPromptFile = await ensureSystemPromptFile(ctx, options)
  const childEnv = await buildChildEnv({ ctx, options, adapterConfig, systemPromptFile })
  const { cliModel, env } = childEnv
  const opencodeSessionId = options.type === 'resume'
    ? await findOpenCodeSessionId({
      binaryPath,
      cwd: ctx.cwd,
      env,
      title,
      maxCount: adapterConfig.native.sessionListMaxCount ?? 50,
      logger: ctx.logger
    }) ?? cachedSession?.opencodeSessionId
    : undefined

  if (options.type === 'create') await ctx.cache.set('adapter.opencode.session', { title })

  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model: cliModel ?? options.model ?? 'default',
      effort: childEnv.effort,
      version: 'unknown',
      tools: DEFAULT_OPENCODE_TOOLS,
      slashCommands: [],
      cwd: ctx.cwd,
      agents: agent ? [agent] : [],
      title
    }
  })

  const proc = spawn(
    binaryPath,
    buildOpenCodeRunArgs({
      prompt: options.description?.trim() !== '' ? options.description?.trim() : undefined,
      files: [],
      model: cliModel,
      agent,
      share: adapterConfig.native.share,
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
          maxCount: adapterConfig.native.sessionListMaxCount ?? 50,
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
