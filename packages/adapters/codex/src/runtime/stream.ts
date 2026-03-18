import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterEvent, AdapterQueryOptions } from '@vibe-forge/core/adapter'
import type { CodexSessionBase } from './session-common'

import { AgentMessageAccumulator, CommandOutputAccumulator, handleIncomingNotification } from '#~/protocol/incoming.js'
import { CodexRpcClient } from '#~/protocol/rpc.js'
import type { CodexInputItem, CodexThread, CodexTurn } from '#~/types.js'

import {
  buildFeatureArgs,
  getErrorMessage,
  isInvalidEncryptedContentError,
  mapContentToCodexInput,
  toCodexOutboundApprovalPolicy
} from './session-common'

/**
 * Spawn `codex app-server` and drive it over JSON-RPC 2.0 (JSONL),
 * forwarding events to `onEvent`.
 */
export async function createStreamCodexSession(
  base: CodexSessionBase,
  ctx: AdapterCtx,
  options: AdapterQueryOptions
) {
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
    threadCacheKey,
    cachedThreadId
  } = base
  const { cache, configs: [config, userConfig] } = ctx
  const { onEvent, description, sessionId, type: sessionType } = options
  const model = resolvedModel
  const rpcApprovalPolicy = toCodexOutboundApprovalPolicy(approvalPolicy)

  const {
    experimentalApi = false,
    effort,
    clientInfo: rawClientInfo = {}
  } = {
    ...(config?.adapters?.codex ?? {}),
    ...(userConfig?.adapters?.codex ?? {})
  } as {
    experimentalApi?: boolean
    effort?: string
    clientInfo?: { name?: string; title?: string; version?: string }
  }
  const clientInfo = {
    name: rawClientInfo.name ?? 'vibe-forge',
    title: rawClientInfo.title ?? 'Vibe Forge',
    version: rawClientInfo.version ?? '0.1.0'
  }

  logger.info('[codex session] spawning app-server (stream mode)', { binaryPath, cwd })

  const proc = spawn(
    String(binaryPath),
    ['app-server', ...configOverrideArgs, ...buildFeatureArgs(features)],
    { env: spawnEnv, cwd, stdio: ['pipe', 'pipe', 'inherit'] }
  )

  const rpc = new CodexRpcClient(proc, logger)
  const msgAcc = new AgentMessageAccumulator()
  const cmdAcc = new CommandOutputAccumulator()
  let threadId: string | undefined
  let activeTurnId: string | undefined
  let usedCachedThread = false
  let didEmitExit = false

  const emitFailureAndExit = (err: unknown) => {
    if (didEmitExit) return
    didEmitExit = true
    const stderr = getErrorMessage(err)
    logger.error('[codex session] stream session failed', { err, sessionId, threadId })
    rpc.destroy(stderr)
    onEvent({ type: 'exit', data: { exitCode: 1, stderr } })
    proc.kill()
  }

  const readThreadCache = async () => (await cache.get('adapter.codex.threads')) ?? {}

  const writeThreadCache = async (nextThreadId: string) => {
    const cachedThreads = await readThreadCache()
    if (cachedThreads[threadCacheKey] === nextThreadId) return
    await cache.set('adapter.codex.threads', { ...cachedThreads, [threadCacheKey]: nextThreadId })
  }

  const deleteCachedThread = async () => {
    const cachedThreads = await readThreadCache()
    if (!(threadCacheKey in cachedThreads)) return
    const { [threadCacheKey]: _removed, ...rest } = cachedThreads
    await cache.set('adapter.codex.threads', rest)
  }

  rpc.onNotification((method, params) => {
    if (method === 'turn/started') {
      activeTurnId = (params as { turn?: { id?: string } }).turn?.id
    } else if (method === 'turn/completed') {
      activeTurnId = undefined
    }
    handleIncomingNotification(method, params, rpc, onEvent, msgAcc, cmdAcc, approvalPolicy)
  })

  proc.on('exit', (code) => {
    if (didEmitExit) return
    didEmitExit = true
    rpc.destroy('process exited')
    onEvent({ type: 'exit', data: { exitCode: code ?? undefined } })
  })

  const startNewThread = async () => {
    logger.info('[codex session] starting new thread', { cwd, sessionId })
    const startResult = await rpc.request<{ thread: CodexThread }>('thread/start', {
      cwd,
      approvalPolicy: rpcApprovalPolicy,
      sandboxPolicy,
      serviceName: 'vibe-forge',
      ...(model ? { model } : {})
    })
    threadId = startResult.thread.id
    usedCachedThread = false
    await writeThreadCache(threadId)
    logger.info('[codex session] thread started', { threadId, sessionId })
  }

  const recoverFromInvalidEncryptedContent = async (source: string) => {
    logger.warn('[codex session] invalid encrypted content detected; starting a fresh thread', {
      sessionId,
      threadId,
      source
    })
    await deleteCachedThread()
    await startNewThread()
  }

  const resumeCachedThread = async (nextThreadId: string) => {
    logger.info('[codex session] resuming thread', { threadId: nextThreadId, sessionId })
    const resumeResult = await rpc.request<{ thread: CodexThread }>('thread/resume', {
      threadId: nextThreadId,
      ...(model ? { model } : {})
    })
    threadId = resumeResult.thread.id
    usedCachedThread = true
    await writeThreadCache(threadId)
  }

  const startTurn = async (input: CodexInputItem[], source: string) => {
    const turnParams: Record<string, unknown> = {
      threadId: threadId!,
      input,
      cwd,
      approvalPolicy: rpcApprovalPolicy,
      sandboxPolicy,
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {})
    }

    try {
      logger.info('[codex session] starting turn', { threadId, input, source })
      const turnResult = await rpc.request<{ turn: CodexTurn }>('turn/start', turnParams)
      logger.info('[codex session] turn started', { turnId: turnResult.turn.id, source })
      return turnResult
    } catch (err) {
      if (usedCachedThread && isInvalidEncryptedContentError(err)) {
        await recoverFromInvalidEncryptedContent(source)
        const retryParams = {
          ...turnParams,
          threadId: threadId!
        }
        logger.info('[codex session] retrying turn on fresh thread', { threadId, source })
        const retryResult = await rpc.request<{ turn: CodexTurn }>('turn/start', retryParams)
        logger.info('[codex session] turn started after retry', { turnId: retryResult.turn.id, source })
        return retryResult
      }
      throw err
    }
  }

  try {
    const initResult = await rpc.request<{ userAgent?: string }>('initialize', {
      clientInfo,
      capabilities: {
        experimentalApi,
        optOutNotificationMethods: [
          'turn/diff/updated',
          'turn/plan/updated',
          'thread/tokenUsage/updated'
        ]
      }
    })
    logger.info('[codex session] initialized', { userAgent: initResult?.userAgent })
    rpc.notify('initialized', {})

    if (sessionType === 'resume' && cachedThreadId != null) {
      try {
        await resumeCachedThread(cachedThreadId)
      } catch (err) {
        if (!isInvalidEncryptedContentError(err)) throw err
        await recoverFromInvalidEncryptedContent('thread/resume')
      }
    } else {
      await startNewThread()
    }

    if (description) {
      const input: CodexInputItem[] = [{ type: 'text', text: description }]
      await startTurn(input, 'initial')
    }
  } catch (err) {
    emitFailureAndExit(err)
    throw err
  }

  const emit = (event: AdapterEvent) => {
    switch (event.type) {
      case 'message': {
        const textItems: CodexInputItem[] = mapContentToCodexInput(
          event.content as Array<{ type: string; text?: string; url?: string }>
        )
        if (activeTurnId != null) {
          rpc.request('turn/steer', {
            threadId: threadId!,
            input: textItems,
            expectedTurnId: activeTurnId
          }).catch((err) => {
            logger.error('[codex session] turn/steer failed', { err })
            emitFailureAndExit(err)
          })
        } else {
          startTurn(textItems, 'emit').catch((err) => {
            logger.error('[codex session] turn/start from emit failed', { err })
            emitFailureAndExit(err)
          })
        }
        break
      }

      case 'interrupt': {
        if (activeTurnId != null) {
          rpc.request('turn/interrupt', {
            threadId: threadId!,
            turnId: activeTurnId
          }).catch((err) => {
            logger.error('[codex session] turn/interrupt failed', { err })
          })
        }
        break
      }

      case 'stop': {
        proc.kill()
        break
      }

      default:
        logger.warn('[codex session] unknown emit event', { event })
        break
    }
  }

  return {
    kill: () => {
      rpc.destroy('killed by caller')
      proc.kill()
    },
    emit,
    pid: proc.pid
  }
}
