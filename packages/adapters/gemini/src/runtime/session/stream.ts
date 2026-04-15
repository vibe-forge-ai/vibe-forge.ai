import { spawn } from 'node:child_process'
import process from 'node:process'

import type {
  AdapterCtx,
  AdapterEvent,
  AdapterOutputEvent,
  AdapterQueryOptions,
  AdapterSession
} from '@vibe-forge/types'

import { resolveGeminiBinaryPath } from '#~/paths.js'

import { ensureGeminiProxyRoute } from '../proxy'
import { buildGeminiNativeHooksSettings } from '../native-hooks'
import {
  buildGeminiRunArgs,
  buildGeminiSettings,
  buildGeminiSpawnEnv,
  createAssistantMessage,
  ensureGeminiPromptFiles,
  ensureGeminiPromptSize,
  getErrorMessage,
  mapGeminiExitCode,
  normalizeGeminiPrompt,
  prefixGeminiToolName,
  resolveGeminiAdapterConfig,
  resolveGeminiApprovalMode,
  resolveGeminiModel,
  toAdapterErrorData,
  validateGeminiSelection,
  writeGeminiSettings
} from '../shared'

const isInvalidResumeError = (value: string) => (
  /invalid session identifier|no previous sessions found/i.test(value)
)

export const createStreamGeminiSession = async (
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

  let destroyed = false
  let currentPid: number | undefined
  let currentKill: (() => void) | undefined
  let didEmitExit = false
  let didEmitFatalError = false
  let geminiSessionId = (await ctx.cache.get('adapter.gemini.session'))?.geminiSessionId

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
    ctx.logger.error('Gemini session turn failed unexpectedly', { err: error })
    emitEvent({ type: 'error', data: toAdapterErrorData(error) })
    emitExit({ exitCode: 1, stderr: getErrorMessage(error) })
  }

  const runTurn = async (
    event: Extract<AdapterEvent, { type: 'message' }>,
    allowRetry: boolean
  ): Promise<void> => {
    if (destroyed) return

    const prompt = normalizeGeminiPrompt(event.content)
    ensureGeminiPromptSize(prompt)
    validateGeminiSelection({
      ctx,
      extraOptions: options.extraOptions,
      model: options.model,
      prompt
    })

    const spawnEnv = buildGeminiSpawnEnv({
      adapterConfig,
      ctx,
      model: resolvedModel.cliModel ?? options.model,
      proxyBaseUrl: proxyRoute?.baseUrl,
      runtime: options.runtime,
      sessionId: options.sessionId
    })
    const resumeSessionId = geminiSessionId
    const proc = spawn(
      binaryPath,
      buildGeminiRunArgs({
        approvalMode,
        extraOptions: options.extraOptions,
        model: resolvedModel.cliModel,
        resumeSessionId
      }),
      {
        cwd: ctx.cwd,
        env: spawnEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      }
    )

    currentPid = proc.pid
    currentKill = () => {
      if (proc.pid == null) return
      try {
        process.kill(proc.pid, 'SIGINT')
      } catch {
      }
    }

    let stdoutBuffer = ''
    let stderrBuffer = ''
    let currentAssistantId: string | undefined
    let currentAssistantText = ''
    let lastAssistantMessage
      : ReturnType<typeof createAssistantMessage>
      | undefined
    let resultErrorMessage: string | undefined

    const resetAssistantSegment = () => {
      currentAssistantId = undefined
      currentAssistantText = ''
    }

    const appendAssistantDelta = (text: string) => {
      if (text === '') return
      if (currentAssistantId == null) {
        currentAssistantId = `gemini-${options.sessionId}-${Date.now()}`
      }
      currentAssistantText += text
      lastAssistantMessage = createAssistantMessage(currentAssistantId, currentAssistantText, options.model)
      emitEvent({ type: 'message', data: lastAssistantMessage })
    }

    const handleParsedEvent = async (parsed: unknown) => {
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return
      }

      const eventRecord = parsed as Record<string, unknown>
      const eventType = typeof eventRecord.type === 'string' ? eventRecord.type : undefined
      if (eventType == null) return

      if (eventType === 'init') {
        const sessionId = typeof eventRecord.session_id === 'string' ? eventRecord.session_id : undefined
        if (sessionId != null && sessionId !== '' && sessionId !== geminiSessionId) {
          geminiSessionId = sessionId
          await ctx.cache.set('adapter.gemini.session', { geminiSessionId: sessionId })
        }
        return
      }

      if (eventType === 'message') {
        if (eventRecord.role === 'assistant' && typeof eventRecord.content === 'string') {
          appendAssistantDelta(eventRecord.content)
        }
        return
      }

      if (eventType === 'tool_use') {
        resetAssistantSegment()
        const toolId = typeof eventRecord.tool_id === 'string' && eventRecord.tool_id !== ''
          ? eventRecord.tool_id
          : `tool-${Date.now()}`
        const toolName = typeof eventRecord.tool_name === 'string' && eventRecord.tool_name !== ''
          ? prefixGeminiToolName(eventRecord.tool_name)
          : prefixGeminiToolName('unknown_tool')
        emitEvent({
          type: 'message',
          data: {
            id: toolId,
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: toolId,
              name: toolName,
              input: eventRecord.parameters ?? {}
            }],
            createdAt: Date.now()
          }
        })
        return
      }

      if (eventType === 'tool_result') {
        resetAssistantSegment()
        const toolId = typeof eventRecord.tool_id === 'string' && eventRecord.tool_id !== ''
          ? eventRecord.tool_id
          : `tool-${Date.now()}`
        const error = (
          eventRecord.error != null &&
          typeof eventRecord.error === 'object' &&
          !Array.isArray(eventRecord.error)
        )
          ? eventRecord.error as { message?: unknown }
          : undefined
        const output = eventRecord.output ?? (
          typeof error?.message === 'string' ? error.message : '[Gemini tool completed without output]'
        )
        emitEvent({
          type: 'message',
          data: {
            id: `tool-result-${toolId}-${Date.now()}`,
            role: 'assistant',
            content: [{
              type: 'tool_result',
              tool_use_id: toolId,
              content: output,
              is_error: eventRecord.status === 'error'
            }],
            createdAt: Date.now()
          }
        })
        return
      }

      if (eventType === 'error') {
        const message = typeof eventRecord.message === 'string'
          ? eventRecord.message
          : 'Gemini reported a non-fatal error.'
        emitEvent({
          type: 'error',
          data: toAdapterErrorData(message, {
            code: eventRecord.severity === 'error' ? 'gemini_error' : 'gemini_warning',
            fatal: false
          })
        })
        return
      }

      if (eventType === 'result' && eventRecord.status === 'error') {
        const resultError = (
          eventRecord.error != null &&
          typeof eventRecord.error === 'object' &&
          !Array.isArray(eventRecord.error)
        )
          ? eventRecord.error as { message?: unknown }
          : undefined
        resultErrorMessage = typeof resultError?.message === 'string'
          ? resultError.message
          : 'Gemini exited with an error result.'
      }
    }

    const handleStdoutLine = async (rawLine: string) => {
      const line = rawLine.trim()
      if (line === '') return

      try {
        await handleParsedEvent(JSON.parse(line))
      } catch {
        ctx.logger.warn('Ignoring non-JSON Gemini stdout line', { line })
      }
    }

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      let newlineIndex = stdoutBuffer.indexOf('\n')
      while (newlineIndex >= 0) {
        const line = stdoutBuffer.slice(0, newlineIndex)
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
        void handleStdoutLine(line)
        newlineIndex = stdoutBuffer.indexOf('\n')
      }
    })

    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (chunk: string) => {
      stderrBuffer += chunk
    })

    proc.stdin.end(prompt)

    const exitCode = await new Promise<number>((resolve, reject) => {
      proc.once('error', reject)
      proc.once('close', (code) => resolve(code ?? 1))
    })

    currentPid = undefined
    currentKill = undefined

    if (stdoutBuffer.trim() !== '') {
      await handleStdoutLine(stdoutBuffer)
    }

    if (destroyed) return

    if (exitCode !== 0) {
      const combinedError = `${resultErrorMessage ?? ''}\n${stderrBuffer}`.trim()
      if (resumeSessionId != null && allowRetry && isInvalidResumeError(combinedError)) {
        geminiSessionId = undefined
        await ctx.cache.set('adapter.gemini.session', {})
        emitEvent({
          type: 'error',
          data: toAdapterErrorData('Cached Gemini session was not found. Starting a fresh native session.', {
            code: 'gemini_resume_missing',
            fatal: false
          })
        })
        await runTurn(event, false)
        return
      }

      if (!didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: toAdapterErrorData(combinedError || `Gemini exited with code ${exitCode}`, {
            code: mapGeminiExitCode(exitCode),
            details: {
              exitCode,
              stderr: stderrBuffer.trim() || undefined
            }
          })
        })
      }
      emitExit({
        exitCode,
        stderr: stderrBuffer.trim() || resultErrorMessage
      })
      return
    }

    emitEvent({
      type: 'stop',
      data: lastAssistantMessage
    })
    emitExit({ exitCode: 0 })
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
