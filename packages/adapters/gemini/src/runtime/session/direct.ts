import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions, AdapterSession } from '@vibe-forge/types'

import { resolveGeminiBinaryPath } from '#~/paths.js'

import { ensureGeminiProxyRoute } from '../proxy'
import { buildGeminiNativeHooksSettings } from '../native-hooks'
import {
  buildGeminiDirectArgs,
  buildGeminiSettings,
  buildGeminiSpawnEnv,
  ensureGeminiPromptFiles,
  getErrorMessage,
  mapGeminiExitCode,
  resolveGeminiAdapterConfig,
  resolveGeminiApprovalMode,
  resolveGeminiModel,
  resolveLatestGeminiSessionId,
  toAdapterErrorData,
  validateGeminiSelection,
  writeGeminiSettings
} from '../shared'

export const createDirectGeminiSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => {
  const adapterConfig = resolveGeminiAdapterConfig(ctx)
  const resolvedModel = resolveGeminiModel({
    ctx,
    model: options.model
  })
  const binaryPath = resolveGeminiBinaryPath(ctx.env)
  const approvalMode = resolveGeminiApprovalMode(options.permissionMode)
  const promptFiles = await ensureGeminiPromptFiles(ctx, options)
  const proxyRoute = resolvedModel.routedService == null
    ? undefined
    : await ensureGeminiProxyRoute(resolvedModel.routedService)
  const nativeHooks = buildGeminiNativeHooksSettings(ctx.env)
  const settings = buildGeminiSettings({
    adapterConfig,
    approvalMode,
    externalAuth: proxyRoute != null,
    generatedContextFileName: promptFiles.generatedContextFileName,
    mcpServers: options.assetPlan?.mcpServers ?? {},
    model: resolvedModel.cliModel,
    nativeHooks
  })
  await writeGeminiSettings(ctx, settings)

  validateGeminiSelection({
    ctx,
    extraOptions: options.extraOptions,
    model: options.model,
    prompt: options.description
  })

  const resumeSessionId = options.type === 'resume'
    ? (await ctx.cache.get('adapter.gemini.session'))?.geminiSessionId
    : undefined
  const startedAt = Date.now()
  const spawnEnv = buildGeminiSpawnEnv({
    adapterConfig,
    ctx,
    model: resolvedModel.cliModel ?? options.model,
    proxyBaseUrl: proxyRoute?.baseUrl,
    runtime: options.runtime,
    sessionId: options.sessionId
  })

  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model: options.model ?? 'default',
      version: 'unknown',
      tools: [],
      slashCommands: [],
      cwd: ctx.cwd,
      agents: []
    }
  })

  const proc = spawn(
    binaryPath,
    buildGeminiDirectArgs({
      approvalMode,
      extraOptions: options.extraOptions,
      model: resolvedModel.cliModel,
      prompt: options.description?.trim() !== '' ? options.description?.trim() : undefined,
      resumeSessionId
    }),
    {
      cwd: ctx.cwd,
      env: spawnEnv,
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
        const geminiSessionId = await resolveLatestGeminiSessionId({
          ctx,
          minMtimeMs: startedAt
        })
        if (geminiSessionId != null) {
          await ctx.cache.set('adapter.gemini.session', { geminiSessionId })
        }
      } else if (!didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: toAdapterErrorData(`Process exited with code ${code ?? 1}`, {
            code: mapGeminiExitCode(code ?? 1),
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
      ctx.logger.warn('emit() is not supported in direct mode for gemini')
    },
    pid: proc.pid
  }
}
