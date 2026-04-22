import process from 'node:process'

import type {
  AdapterCtx,
  AdapterEvent,
  AdapterOutputEvent,
  AdapterQueryOptions,
  AdapterSession
} from '@vibe-forge/types'

import { resolveOpenCodeBinaryPath } from '../../paths'
import {
  DEFAULT_OPENCODE_TOOLS,
  buildOpenCodeRunArgs,
  buildOpenCodeSessionTitle,
  normalizeOpenCodePrompt,
  resolveOpenCodeAgent
} from '../common'
import { buildChildEnv, ensureSystemPromptFile } from './child-env'
import { findOpenCodeSessionId, runOpenCodeCommand } from './process'
import {
  createAssistantMessage,
  extractTextFromOpenCodeJsonEvents,
  getErrorMessage,
  resolveAdapterConfig,
  stripAnsi,
  toAdapterErrorData
} from './shared'

export const createStreamOpenCodeSession = async (
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
  const systemPromptFile = await ensureSystemPromptFile(ctx, options)
  const childEnv = await buildChildEnv({ ctx, options, adapterConfig, systemPromptFile })
  const cachedSession = options.type === 'resume' ? await ctx.cache.get('adapter.opencode.session') : undefined

  if (options.type === 'create') await ctx.cache.set('adapter.opencode.session', { title })

  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model: childEnv.cliModel ?? options.model ?? 'default',
      effort: childEnv.effort,
      version: 'unknown',
      tools: DEFAULT_OPENCODE_TOOLS,
      slashCommands: [],
      cwd: ctx.cwd,
      agents: agent ? [agent] : [],
      title
    }
  })

  let destroyed = false
  let currentPid: number | undefined
  let currentKill: (() => void) | undefined
  let opencodeSessionId = cachedSession?.opencodeSessionId
  let didEmitFatalError = false
  let didEmitExit = false

  const emitEvent = (event: AdapterOutputEvent) => {
    if (event.type === 'error' && event.data.fatal !== false) {
      didEmitFatalError = true
    }
    options.onEvent(event)
  }
  const emitExit = (data: { exitCode: number; stderr?: string }) => {
    if (didEmitExit) return
    didEmitExit = true
    emitEvent({ type: 'exit', data })
  }

  const emitUnexpectedExit = (error: unknown) => {
    if (destroyed) return
    destroyed = true
    currentPid = undefined
    currentKill = undefined
    ctx.logger.error('OpenCode session turn failed unexpectedly', { err: error })
    emitEvent({ type: 'error', data: toAdapterErrorData(error) })
    emitExit({ exitCode: 1, stderr: getErrorMessage(error) })
  }

  const runTurn = async (content: Extract<AdapterEvent, { type: 'message' }>, allowRetry: boolean): Promise<void> => {
    if (destroyed) return
    const normalized = normalizeOpenCodePrompt(content.content)
    const { cliModel, env } = childEnv

    if (opencodeSessionId == null && options.type === 'resume') {
      opencodeSessionId = await findOpenCodeSessionId({
        binaryPath,
        cwd: ctx.cwd,
        env,
        title,
        maxCount: adapterConfig.native.sessionListMaxCount ?? 50,
        logger: ctx.logger
      })
    }

    const result = await runOpenCodeCommand({
      binaryPath,
      args: buildOpenCodeRunArgs({
        prompt: normalized.prompt,
        files: normalized.files,
        model: cliModel,
        agent,
        share: adapterConfig.native.share,
        title,
        dir: ctx.cwd,
        opencodeSessionId,
        extraOptions: options.extraOptions,
        format: 'json'
      }),
      cwd: ctx.cwd,
      env,
      onStart: (pid) => {
        currentPid = pid
        currentKill = () => {
          if (pid != null) {
            try {
              process.kill(pid, 'SIGINT')
            } catch {
            }
          }
        }
      }
    })

    currentPid = undefined
    currentKill = undefined
    if (destroyed) return

    const output = extractTextFromOpenCodeJsonEvents(result.stdout).trim()
    const error = stripAnsi(result.stderr).trim()
    if (result.exitCode !== 0) {
      const missingSession = /session.+not found|no session found/i.test(`${result.stdout}\n${error}`)
      if (missingSession && opencodeSessionId != null && allowRetry) {
        opencodeSessionId = undefined
        await ctx.cache.set('adapter.opencode.session', { title })
        await runTurn(content, false)
        return
      }
      if (!didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: toAdapterErrorData(result.stderr || result.stdout || `Process exited with code ${result.exitCode}`, {
            details: {
              exitCode: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr
            }
          })
        })
      }
      emitExit({ exitCode: result.exitCode, stderr: result.stderr || result.stdout })
      return
    }

    const resolvedSessionId = await findOpenCodeSessionId({
      binaryPath,
      cwd: ctx.cwd,
      env,
      title,
      maxCount: adapterConfig.native.sessionListMaxCount ?? 50,
      logger: ctx.logger
    })
    if (resolvedSessionId) {
      opencodeSessionId = resolvedSessionId
      await ctx.cache.set('adapter.opencode.session', { opencodeSessionId, title })
    }

    const assistantMessage = createAssistantMessage(
      output === '' ? (stripAnsi(result.stdout).trim() || '[OpenCode completed without text output]') : output,
      cliModel
    )
    emitEvent({ type: 'message', data: assistantMessage })
    emitEvent({ type: 'stop', data: assistantMessage })
  }

  let queue = Promise.resolve()
  const enqueueMessage = (event: Extract<AdapterEvent, { type: 'message' }>) => {
    queue = queue.catch(() => undefined).then(async () => {
      try {
        await runTurn(event, true)
      } catch (error) {
        emitUnexpectedExit(error)
      }
    })
  }

  if (options.description != null && options.description.trim() !== '') {
    enqueueMessage({ type: 'message', content: [{ type: 'text', text: options.description }] })
  }

  return {
    kill: () => {
      destroyed = true
      currentKill?.()
    },
    stop: () => {
      if (destroyed) return
      destroyed = true
      currentKill?.()
      if (currentPid == null) {
        emitExit({ exitCode: 0 })
      }
    },
    emit: (event) => {
      if (destroyed) return
      if (event.type === 'message') enqueueMessage(event)
      if (event.type === 'interrupt') currentKill?.()
      if (event.type === 'stop') {
        destroyed = true
        currentKill?.()
      }
    },
    get pid() {
      return currentPid
    }
  }
}
