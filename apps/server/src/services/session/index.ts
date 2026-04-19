import { env as processEnv } from 'node:process'

import { v4 as uuidv4 } from 'uuid'

import { generateAdapterQueryOptions, run } from '@vibe-forge/app-runtime'
import type {
  ChatMessage,
  ChatMessageContent,
  EffortLevel,
  Session,
  SessionPermissionMode,
  WSEvent
} from '@vibe-forge/core'
import type {
  AdapterErrorData,
  AdapterOutputEvent,
  AdapterQueryOptions,
  AskUserQuestionParams,
  PermissionInteractionDecision,
  SessionInfo,
  SessionPromptType
} from '@vibe-forge/types'

import { handleChannelSessionEvent, resolveChannelSessionMcpServers } from '#~/channels/index.js'
import { getDb } from '#~/db/index.js'
import { loadConfigState } from '#~/services/config/index.js'
import { applySessionEvent } from '#~/services/session/events.js'
import {
  canRequestInteraction,
  requestInteraction,
  resolvePendingInteractionAsCancelled
} from '#~/services/session/interaction.js'
import { maybeNotifySession } from '#~/services/session/notification.js'
import {
  applyPermissionInteractionDecision,
  buildPermissionInteractionPayload,
  resolvePermissionDecision as resolveStoredPermissionDecision,
  resolvePermissionSubjectFromInput,
  syncPermissionStateMirrorBestEffort
} from '#~/services/session/permission.js'
import {
  armNextQueueInterrupt,
  listSessionQueuedMessages,
  maybeDispatchQueuedTurn,
  shouldInterruptForQueuedNext
} from '#~/services/session/queue.js'
import type { AdapterSessionRuntime } from '#~/services/session/runtime.js'
import {
  bindAdapterSessionRuntime,
  broadcastSessionEvent,
  createSessionConnectionState,
  deleteAdapterSessionRuntime,
  deleteExternalSessionRuntime,
  emitRuntimeEvent,
  getAdapterSessionRuntime,
  getExternalSessionRuntime,
  notifySessionUpdated,
  parkAdapterSessionRuntime,
  setAdapterSessionRuntime,
  takeExternalSessionRuntime
} from '#~/services/session/runtime.js'
import { provisionSessionWorkspace, resolveSessionWorkspace } from '#~/services/session/workspace.js'
import { runConfiguredWorktreeEnvironmentScripts } from '#~/services/worktree-environments.js'
import { getSessionLogger } from '#~/utils/logger.js'

const activeAdapterRunStore = new Map<string, string>()
export const adapterSessionStartStore = new Map<string, Promise<AdapterSessionRuntime>>()
const pendingPermissionRecoveryStore = new Map<string, { runId: string; interactionId?: string }>()
const recentPermissionToolUseStore = new Map<string, Map<string, string>>()
const PERMISSION_REQUIRED_CODE = 'permission_required'
const PERMISSION_DECISION_CANCEL = 'cancel'
const PERMISSION_CONTINUE_PROMPT = '权限规则已更新。请继续刚才被权限拦截的工作，并重试被阻止的操作。'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

const uniqueStrings = (values: string[]) => [...new Set(values)]

const getPermissionToolUseCache = (sessionId: string) => {
  let cache = recentPermissionToolUseStore.get(sessionId)
  if (cache != null) {
    return cache
  }
  cache = new Map<string, string>()
  recentPermissionToolUseStore.set(sessionId, cache)
  return cache
}

const trimPermissionToolUseCache = (cache: Map<string, string>, maxSize = 128) => {
  while (cache.size > maxSize) {
    const firstKey = cache.keys().next().value as string | undefined
    if (firstKey == null) {
      break
    }
    cache.delete(firstKey)
  }
}

const rememberPermissionToolUses = (sessionId: string, message: unknown) => {
  if (!isRecord(message) || !Array.isArray(message.content)) {
    return
  }

  const cache = getPermissionToolUseCache(sessionId)
  for (const item of message.content) {
    if (!isRecord(item) || item.type !== 'tool_use' || !isNonEmptyString(item.id)) {
      continue
    }

    const rawName = isNonEmptyString(item.name) ? item.name.trim() : undefined
    const normalizedToolName = rawName?.startsWith('adapter:')
      ? rawName.split(':').at(-1)?.trim() ?? rawName
      : rawName
    const subject = resolvePermissionSubjectFromInput({
      toolName: normalizedToolName ?? rawName
    })
    if (subject == null) {
      continue
    }

    cache.set(item.id.trim(), subject.key)
  }

  trimPermissionToolUseCache(cache)
}

const resolvePermissionInteractionDecision = (
  answer: string | string[]
): PermissionInteractionDecision | typeof PERMISSION_DECISION_CANCEL | undefined => {
  const normalizedAnswer = Array.isArray(answer) ? answer[0] : answer
  if (typeof normalizedAnswer !== 'string') return undefined

  const raw = normalizedAnswer.trim()
  if (raw === '') return undefined
  if (raw === PERMISSION_DECISION_CANCEL) return PERMISSION_DECISION_CANCEL

  if (
    raw === 'allow_once' ||
    raw === 'allow_session' ||
    raw === 'allow_project' ||
    raw === 'deny_once' ||
    raw === 'deny_session' ||
    raw === 'deny_project'
  ) {
    return raw
  }

  return undefined
}

const emitSessionError = (sessionId: string, data: AdapterErrorData) => {
  const event: WSEvent = {
    type: 'error',
    data,
    message: data.message
  }

  applySessionEvent(sessionId, event, {
    broadcast: (ev) => broadcastSessionEvent(sessionId, ev),
    onSessionUpdated: (session) => {
      notifySessionUpdated(sessionId, session)
    }
  })
}

const buildPermissionDeclinedError = (message: string, code = 'permission_request_declined'): AdapterErrorData => ({
  message,
  code,
  fatal: true
})

const extractPermissionErrorContext = (error: AdapterErrorData) => {
  const details = isRecord(error.details) ? error.details : {}
  const rawDeniedTools = new Set<string>()
  const reasons = new Set<string>()

  const permissionDenials = Array.isArray(details.permissionDenials) ? details.permissionDenials : []
  for (const denial of permissionDenials) {
    if (!isRecord(denial)) continue
    if (isNonEmptyString(denial.message)) {
      reasons.add(denial.message.trim())
    }
    if (Array.isArray(denial.deniedTools)) {
      for (const tool of denial.deniedTools) {
        if (isNonEmptyString(tool)) {
          rawDeniedTools.add(tool.trim())
        }
      }
    }
  }

  if (Array.isArray(details.deniedTools)) {
    for (const tool of details.deniedTools) {
      if (isNonEmptyString(tool)) {
        rawDeniedTools.add(tool.trim())
      }
    }
  }

  if (isNonEmptyString(details.toolName)) {
    rawDeniedTools.add(details.toolName.trim())
  }

  if (isNonEmptyString(error.message)) {
    reasons.add(error.message.trim())
  }

  const deniedTools = [...rawDeniedTools]
  const subjectKeys = uniqueStrings(
    deniedTools
      .map(tool => resolvePermissionSubjectFromInput({ toolName: tool })?.key)
      .filter((key): key is string => key != null && key.trim() !== '')
  )

  return {
    subjectKeys,
    deniedTools,
    reasons: [...reasons]
  }
}

const resolvePermissionErrorContext = (sessionId: string, error: AdapterErrorData) => {
  const context = extractPermissionErrorContext(error)
  if (context.subjectKeys.length > 0) {
    return context
  }

  const details = isRecord(error.details) ? error.details : {}
  const toolUseId = isNonEmptyString(details.toolUseId) ? details.toolUseId.trim() : undefined
  if (toolUseId == null || toolUseId === '') {
    return context
  }

  const cachedSubjectKey = recentPermissionToolUseStore.get(sessionId)?.get(toolUseId)
  if (cachedSubjectKey == null || cachedSubjectKey.trim() === '') {
    return context
  }

  return {
    subjectKeys: uniqueStrings([...context.subjectKeys, cachedSubjectKey]),
    deniedTools: uniqueStrings([...context.deniedTools, cachedSubjectKey]),
    reasons: context.reasons
  }
}

const resolvePermissionInteractionPayload = (
  sessionId: string,
  adapter: string | undefined,
  permissionMode: SessionPermissionMode | undefined,
  error: AdapterErrorData
): AskUserQuestionParams => {
  const context = resolvePermissionErrorContext(sessionId, error)
  return buildPermissionInteractionPayload({
    sessionId,
    adapter,
    subjectKeys: context.subjectKeys,
    deniedTools: context.deniedTools,
    reasons: context.reasons,
    currentMode: permissionMode
  })
}

export const resetSessionServiceState = () => {
  activeAdapterRunStore.clear()
  adapterSessionStartStore.clear()
  pendingPermissionRecoveryStore.clear()
  recentPermissionToolUseStore.clear()
}

const clearPendingPermissionRecovery = (sessionId: string) => {
  const pending = pendingPermissionRecoveryStore.get(sessionId)
  if (pending == null) {
    return undefined
  }

  pendingPermissionRecoveryStore.delete(sessionId)
  return pending
}

export async function startAdapterSession(
  sessionId: string,
  options: {
    model?: string
    effort?: EffortLevel
    systemPrompt?: string
    appendSystemPrompt?: boolean
    permissionMode?: SessionPermissionMode
    promptType?: SessionPromptType
    promptName?: string
    adapter?: string
  } = {}
) {
  const inFlight = adapterSessionStartStore.get(sessionId)
  if (inFlight != null) {
    return inFlight
  }

  const startPromise = (async () => {
    const db = getDb()
    const historyMessages = db.getMessages(sessionId) as WSEvent[]
    const hasHistory = historyMessages.length > 0
    const serverLogger = getSessionLogger(sessionId, 'server')
    const existing = db.getSession(sessionId)
    const runtimeState = db.getSessionRuntimeState(sessionId)
    const resolvedModel = options.model ?? existing?.model
    const resolvedAdapter = options.adapter ?? existing?.adapter
    const resolvedEffort = options.effort ?? existing?.effort
    const resolvedPermissionMode = options.permissionMode ?? existing?.permissionMode
    const resolvedPromptType = existing?.promptType ?? options.promptType
    const resolvedPromptName = existing?.promptName ?? options.promptName
    const seededFromHistory = runtimeState?.historySeedPending === true &&
      runtimeState.historySeed != null &&
      runtimeState.historySeed.trim() !== ''
    const adapterChanged = existing?.adapter != null && resolvedAdapter != null && existing.adapter !== resolvedAdapter
    const type = !seededFromHistory && hasHistory && !adapterChanged ? 'resume' : 'create'

    const cached = getAdapterSessionRuntime(sessionId)
    if (cached != null) {
      const currentModel = cached.config?.model
      const currentAdapter = cached.config?.adapter
      const currentEffort = cached.config?.effort
      const currentPermissionMode = cached.config?.permissionMode
      const currentPromptType = cached.config?.promptType
      const currentPromptName = cached.config?.promptName
      const configChanged = currentModel !== resolvedModel ||
        currentAdapter !== resolvedAdapter ||
        currentEffort !== resolvedEffort ||
        currentPermissionMode !== resolvedPermissionMode ||
        currentPromptType !== resolvedPromptType ||
        currentPromptName !== resolvedPromptName

      if (!configChanged) {
        serverLogger.info({ sessionId }, '[server] Reusing existing adapter process')
        return cached
      }

      serverLogger.info({
        sessionId,
        currentModel,
        resolvedModel,
        currentAdapter,
        resolvedAdapter,
        currentEffort,
        resolvedEffort,
        currentPermissionMode,
        resolvedPermissionMode,
        currentPromptType,
        resolvedPromptType,
        currentPromptName,
        resolvedPromptName
      }, '[server] Restarting adapter process due to session config change')
      activeAdapterRunStore.delete(sessionId)
      cached.session.kill()
      deleteAdapterSessionRuntime(sessionId)
    }

    serverLogger.info({
      sessionId,
      type,
      requestedModel: options.model,
      persistedModel: existing?.model,
      resolvedModel,
      requestedAdapter: options.adapter,
      persistedAdapter: existing?.adapter,
      resolvedAdapter,
      resolvedEffort,
      resolvedPermissionMode,
      resolvedPromptType,
      resolvedPromptName
    }, '[server] Starting new adapter process')

    if (existing == null) {
      serverLogger.info({ sessionId }, '[server] Session not found in DB, creating new entry')
      db.createSession(undefined, sessionId, undefined, undefined, {
        runtimeKind: 'interactive'
      })
      await provisionSessionWorkspace(sessionId)
    }

    if (
      resolvedModel !== existing?.model || resolvedAdapter !== existing?.adapter ||
      resolvedEffort !== existing?.effort ||
      resolvedPermissionMode !== existing?.permissionMode ||
      resolvedPromptType !== existing?.promptType ||
      resolvedPromptName !== existing?.promptName
    ) {
      updateAndNotifySession(sessionId, {
        model: resolvedModel,
        adapter: resolvedAdapter,
        effort: resolvedEffort,
        permissionMode: resolvedPermissionMode,
        promptType: resolvedPromptType,
        promptName: resolvedPromptName
      })
    }

    const connectionState = takeExternalSessionRuntime(sessionId) ?? createSessionConnectionState()
    const runId = uuidv4()
    activeAdapterRunStore.set(sessionId, runId)

    try {
      const workspace = await resolveSessionWorkspace(sessionId)
      const promptCwd = workspace.workspaceFolder
      const startScriptResults = await runConfiguredWorktreeEnvironmentScripts({
        operation: 'start',
        workspaceFolder: promptCwd,
        environmentId: workspace.worktreeEnvironment,
        sessionId
      })
      if (startScriptResults.length > 0) {
        serverLogger.info({
          sessionId,
          scripts: startScriptResults.map(result => result.scriptPath)
        }, '[server] Ran worktree environment start scripts')
      }
      const [data, resolvedConfig] = await generateAdapterQueryOptions(
        resolvedPromptType,
        resolvedPromptName,
        promptCwd,
        {
          adapter: resolvedAdapter,
          model: resolvedModel
        }
      )
      const adapterCwd = resolvedConfig.workspace?.cwd ?? promptCwd
      const primaryWorkspaceFolder = processEnv.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__?.trim() ||
        processEnv.__VF_PROJECT_WORKSPACE_FOLDER__?.trim() ||
        promptCwd
      const env = {
        ...processEnv,
        __VF_PROJECT_AI_CTX_ID__: processEnv.__VF_PROJECT_AI_CTX_ID__ ?? sessionId,
        __VF_PROJECT_WORKSPACE_FOLDER__: adapterCwd,
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: primaryWorkspaceFolder
      }
      const finalSystemPrompt = options.appendSystemPrompt === false
        ? (options.systemPrompt ?? resolvedConfig.systemPrompt)
        : [resolvedConfig.systemPrompt, options.systemPrompt]
          .filter(Boolean)
          .join('\n\n')
      const { mergedConfig } = await loadConfigState(adapterCwd)
        .catch(() => ({ mergedConfig: {} as { modelLanguage?: string } }))
      const { modelLanguage } = mergedConfig
      const languagePrompt = modelLanguage == null
        ? undefined
        : (modelLanguage === 'en' ? 'Please respond in English.' : '请使用中文进行对话。')
      const mergedSystemPrompt = [
        finalSystemPrompt,
        seededFromHistory ? runtimeState?.historySeed?.trim() : undefined,
        languagePrompt
      ].filter(Boolean).join('\n\n')
      let sawFatalError = false
      let runtimeMcpServers: AdapterQueryOptions['runtimeMcpServers']

      try {
        const resolvedChannelMcpServers = await resolveChannelSessionMcpServers(sessionId)
        if (Object.keys(resolvedChannelMcpServers).length > 0) {
          runtimeMcpServers = resolvedChannelMcpServers
        }
      } catch (error) {
        serverLogger.warn({
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        }, '[channel] Failed to resolve session companion MCP servers')
      }

      await syncPermissionStateMirrorBestEffort(sessionId, {
        adapter: resolvedAdapter
      })

      const { session } = await run({
        env,
        cwd: adapterCwd,
        adapter: resolvedAdapter
      }, {
        type,
        runtime: 'server',
        sessionId,
        model: resolvedModel,
        effort: resolvedEffort,
        systemPrompt: mergedSystemPrompt,
        permissionMode: resolvedPermissionMode,
        appendSystemPrompt: options.appendSystemPrompt ?? true,
        tools: resolvedConfig.tools,
        mcpServers: resolvedConfig.mcpServers,
        runtimeMcpServers,
        promptAssetIds: resolvedConfig.promptAssetIds,
        assetBundle: resolvedConfig.assetBundle,
        onEvent: (event: AdapterOutputEvent) => {
          if (activeAdapterRunStore.get(sessionId) !== runId) {
            return
          }

          const broadcast = (ev: WSEvent) => {
            serverLogger.info({ event: 'broadcast', data: ev }, 'Broadcasting event')
            emitRuntimeEvent(connectionState, ev)
          }

          const applyEvent = (ev: WSEvent) => {
            applySessionEvent(sessionId, ev, {
              broadcast,
              onSessionUpdated: (session) => {
                notifySessionUpdated(sessionId, session)
              }
            })
            void handleChannelSessionEvent(sessionId, ev).catch(() => undefined)
          }

          switch (event.type) {
            case 'init':
              if ('model' in (event.data as any)) {
                const reportedModel = typeof (event.data as any).model === 'string'
                  ? (event.data as any).model
                  : undefined
                const reportedAdapter = typeof (event.data as any).adapter === 'string'
                  ? (event.data as any).adapter
                  : undefined
                const persistedModel = resolvedModel ?? reportedModel
                const persistedAdapter = resolvedAdapter ?? reportedAdapter
                serverLogger.info({
                  sessionId,
                  requestedModel: options.model,
                  resolvedModel,
                  reportedModel,
                  persistedModel,
                  requestedAdapter: options.adapter,
                  resolvedAdapter,
                  reportedAdapter,
                  persistedAdapter
                }, '[server] Adapter init received')
                updateAndNotifySession(sessionId, {
                  model: persistedModel,
                  adapter: persistedAdapter,
                  effort: resolvedEffort,
                  permissionMode: resolvedPermissionMode,
                  promptType: resolvedPromptType,
                  promptName: resolvedPromptName
                })
                applyEvent({
                  type: 'session_info',
                  info: {
                    type: 'init',
                    ...(event.data as any)
                  } as SessionInfo
                })
              }
              break
            case 'message':
              if ('role' in (event.data as any)) {
                if ((event.data as any).role === 'assistant') {
                  rememberPermissionToolUses(sessionId, event.data)
                }
                if (
                  pendingPermissionRecoveryStore.get(sessionId)?.runId === runId &&
                  (event.data as any).role === 'assistant'
                ) {
                  break
                }
                applyEvent({
                  type: 'message',
                  message: event.data
                })
                if (
                  (event.data as any).role === 'assistant' &&
                  shouldInterruptForQueuedNext(sessionId, {
                    type: 'message',
                    message: event.data
                  })
                ) {
                  interruptSession(sessionId)
                }
              }
              break
            case 'interaction_request': {
              const interaction = event.data
              const permissionContext = interaction.payload.kind === 'permission'
                ? interaction.payload.permissionContext
                : undefined
              const subject = permissionContext?.subjectKey != null
                ? resolvePermissionSubjectFromInput({ toolName: permissionContext.subjectKey })
                : undefined

              if (typeof session.respondInteraction === 'function') {
                void (async () => {
                  try {
                    if (subject != null) {
                      const storedDecision = await resolveStoredPermissionDecision({
                        sessionId,
                        subject,
                        lookupKeys: permissionContext?.subjectLookupKeys
                      })
                      if (activeAdapterRunStore.get(sessionId) !== runId) return

                      if (storedDecision.result === 'allow') {
                        await session.respondInteraction?.(
                          interaction.id,
                          storedDecision.source === 'onceAllow' ? 'allow_once' : 'allow_session'
                        )
                        return
                      }

                      if (storedDecision.result === 'deny') {
                        await session.respondInteraction?.(
                          interaction.id,
                          storedDecision.source === 'projectDeny' ? 'deny_project' : 'deny_session'
                        )
                        return
                      }
                    }

                    if (!canRequestInteraction(sessionId)) {
                      await session.respondInteraction?.(interaction.id, PERMISSION_DECISION_CANCEL)
                      emitSessionError(sessionId, {
                        message: '权限确认通道不可用，已取消当前操作。',
                        code: 'permission_request_failed',
                        fatal: true
                      })
                      return
                    }

                    pendingPermissionRecoveryStore.set(sessionId, {
                      runId,
                      interactionId: interaction.id
                    })
                    const answer = await requestInteraction(interaction.payload, {
                      interactionId: interaction.id
                    })
                    if (
                      pendingPermissionRecoveryStore.get(sessionId)?.runId !== runId ||
                      pendingPermissionRecoveryStore.get(sessionId)?.interactionId !== interaction.id
                    ) {
                      return
                    }

                    pendingPermissionRecoveryStore.delete(sessionId)
                    const decision = resolvePermissionInteractionDecision(answer)
                    if (decision == null || decision === PERMISSION_DECISION_CANCEL) {
                      await session.respondInteraction?.(interaction.id, PERMISSION_DECISION_CANCEL)
                      emitSessionError(sessionId, buildPermissionDeclinedError('用户取消了本次权限授权。'))
                      return
                    }

                    if (decision !== 'deny_once') {
                      const subjectKey = permissionContext?.subjectKey
                      if (subjectKey != null && subjectKey.trim() !== '') {
                        await applyPermissionInteractionDecision({
                          sessionId,
                          subjectKeys: [subjectKey],
                          action: decision
                        })
                      }
                    }

                    await session.respondInteraction?.(interaction.id, decision)
                  } catch (error) {
                    if (
                      pendingPermissionRecoveryStore.get(sessionId)?.runId === runId &&
                      pendingPermissionRecoveryStore.get(sessionId)?.interactionId === interaction.id
                    ) {
                      pendingPermissionRecoveryStore.delete(sessionId)
                    }
                    await session.respondInteraction?.(interaction.id, PERMISSION_DECISION_CANCEL)
                    emitSessionError(sessionId, {
                      message: error instanceof Error && error.message.includes('timed out')
                        ? '权限确认已超时，已取消当前操作。'
                        : '权限确认失败，已取消当前操作。',
                      code: 'permission_request_failed',
                      details: error instanceof Error ? { message: error.message } : { error: String(error) },
                      fatal: true
                    })
                  }
                })()
                break
              }

              void requestInteraction(interaction.payload, {
                interactionId: interaction.id
              }).catch(() => undefined)
              break
            }
            case 'error':
              if (
                event.data.code === PERMISSION_REQUIRED_CODE &&
                pendingPermissionRecoveryStore.get(sessionId)?.runId === runId
              ) {
                break
              }
              if (
                event.data.code === PERMISSION_REQUIRED_CODE &&
                !pendingPermissionRecoveryStore.has(sessionId) &&
                canRequestInteraction(sessionId)
              ) {
                const permissionPrompt = resolvePermissionInteractionPayload(
                  sessionId,
                  resolvedAdapter,
                  resolvedPermissionMode,
                  event.data
                )

                pendingPermissionRecoveryStore.set(sessionId, { runId })
                void requestInteraction(permissionPrompt)
                  .then(async (answer) => {
                    if (pendingPermissionRecoveryStore.get(sessionId)?.runId !== runId) {
                      return
                    }

                    const { subjectKeys } = resolvePermissionErrorContext(sessionId, event.data)
                    const decision = resolvePermissionInteractionDecision(answer)
                    if (decision == null || decision === PERMISSION_DECISION_CANCEL) {
                      pendingPermissionRecoveryStore.delete(sessionId)
                      emitSessionError(
                        sessionId,
                        buildPermissionDeclinedError('用户取消了本次权限授权，任务未继续执行。')
                      )
                      return
                    }

                    if (decision === 'deny_once') {
                      pendingPermissionRecoveryStore.delete(sessionId)
                      emitSessionError(sessionId, buildPermissionDeclinedError('已拒绝本次权限授权，任务未继续执行。'))
                      return
                    }

                    if (subjectKeys.length > 0) {
                      await applyPermissionInteractionDecision({
                        sessionId,
                        subjectKeys,
                        action: decision
                      })
                    }

                    if (decision === 'deny_session' || decision === 'deny_project') {
                      pendingPermissionRecoveryStore.delete(sessionId)
                      emitSessionError(sessionId, buildPermissionDeclinedError('已记录权限拒绝规则，任务未继续执行。'))
                      return
                    }

                    try {
                      if (activeAdapterRunStore.get(sessionId) === runId) {
                        activeAdapterRunStore.delete(sessionId)
                      }
                      const activeRuntime = getAdapterSessionRuntime(sessionId)
                      if (activeRuntime?.config?.runId === runId) {
                        activeRuntime.session.kill()
                        deleteAdapterSessionRuntime(sessionId)
                      }

                      pendingPermissionRecoveryStore.delete(sessionId)
                      updateAndNotifySession(sessionId, {
                        status: 'running'
                      })
                      const recovered = await startAdapterSession(sessionId, {
                        model: resolvedModel,
                        adapter: resolvedAdapter,
                        effort: resolvedEffort,
                        permissionMode: resolvedPermissionMode,
                        promptType: resolvedPromptType,
                        promptName: resolvedPromptName
                      })
                      recovered.session.emit({
                        type: 'message',
                        content: [
                          {
                            type: 'text',
                            text: PERMISSION_CONTINUE_PROMPT
                          }
                        ]
                      })
                    } catch (error) {
                      pendingPermissionRecoveryStore.delete(sessionId)
                      emitSessionError(sessionId, {
                        message: '权限规则已更新，但恢复会话失败。',
                        code: 'permission_recovery_failed',
                        details: error instanceof Error ? { message: error.message } : { error: String(error) },
                        fatal: true
                      })
                    }
                  })
                  .catch((error) => {
                    if (pendingPermissionRecoveryStore.get(sessionId)?.runId !== runId) {
                      return
                    }

                    pendingPermissionRecoveryStore.delete(sessionId)
                    emitSessionError(sessionId, {
                      message: error instanceof Error && error.message.includes('timed out')
                        ? '权限确认已超时，任务未继续执行。'
                        : '权限确认失败，任务未继续执行。',
                      code: 'permission_request_failed',
                      details: error instanceof Error ? { message: error.message } : { error: String(error) },
                      fatal: true
                    })
                  })
                break
              }

              if (event.data.fatal !== false) {
                sawFatalError = true
              }
              applyEvent({
                type: 'error',
                data: event.data,
                message: event.data.message
              })
              break
            case 'exit': {
              const { exitCode, stderr } = event.data as { exitCode: number; stderr: string }
              if (pendingPermissionRecoveryStore.get(sessionId)?.runId === runId) {
                parkAdapterSessionRuntime(sessionId)
                if (activeAdapterRunStore.get(sessionId) === runId) {
                  activeAdapterRunStore.delete(sessionId)
                }
                break
              }

              recentPermissionToolUseStore.delete(sessionId)

              updateAndNotifySession(sessionId, {
                status: exitCode === 0 ? 'completed' : 'failed'
              })
              if (exitCode === 0) {
                maybeDispatchQueuedTurn(sessionId, async (content) => {
                  await processUserMessage(sessionId, content)
                })
              }
              if (exitCode !== 0 && !sawFatalError) {
                emitRuntimeEvent(connectionState, {
                  type: 'error',
                  data: {
                    message: stderr !== ''
                      ? `Process exited with code ${exitCode}, stderr:\n${stderr}`
                      : `Process exited with code ${exitCode}`,
                    details: stderr !== '' ? { stderr } : undefined,
                    fatal: true
                  },
                  message: stderr !== ''
                    ? `Process exited with code ${exitCode}, stderr:\n${stderr}`
                    : `Process exited with code ${exitCode}`
                }, { recordMessage: false })
              }

              deleteAdapterSessionRuntime(sessionId)
              if (activeAdapterRunStore.get(sessionId) === runId) {
                activeAdapterRunStore.delete(sessionId)
              }
              break
            }
            case 'summary': {
              const summaryData = event.data as { summary: string; leafUuid: string }
              applyEvent({
                type: 'session_info',
                info: {
                  type: 'summary',
                  summary: summaryData.summary,
                  leafUuid: summaryData.leafUuid
                }
              })
              break
            }
            case 'stop': {
              if (pendingPermissionRecoveryStore.get(sessionId)?.runId === runId) {
                break
              }
              const latestSession = getDb().getSession(sessionId)
              if (latestSession?.status !== 'failed') {
                updateAndNotifySession(sessionId, { status: 'completed' })
                maybeDispatchQueuedTurn(sessionId, async (content) => {
                  await processUserMessage(sessionId, content)
                })
              }
              break
            }
          }
        }
      })

      if (seededFromHistory) {
        db.updateSessionRuntimeState(sessionId, { historySeedPending: false })
      }

      const runtime = setAdapterSessionRuntime(
        sessionId,
        bindAdapterSessionRuntime(connectionState, session, {
          runId,
          model: resolvedModel,
          adapter: resolvedAdapter,
          effort: resolvedEffort,
          permissionMode: resolvedPermissionMode,
          promptType: resolvedPromptType,
          promptName: resolvedPromptName,
          seededFromHistory
        })
      )
      if (listSessionQueuedMessages(sessionId).next.length > 0) {
        armNextQueueInterrupt(sessionId)
      }
      return runtime
    } catch (err) {
      if (activeAdapterRunStore.get(sessionId) === runId) {
        activeAdapterRunStore.delete(sessionId)
      }
      updateAndNotifySession(sessionId, { status: 'failed' })
      serverLogger.error({ err, sessionId }, '[server] session init error')
      throw err
    }
  })()

  adapterSessionStartStore.set(sessionId, startPromise)

  try {
    return await startPromise
  } finally {
    if (adapterSessionStartStore.get(sessionId) === startPromise) {
      adapterSessionStartStore.delete(sessionId)
    }
  }
}

function extractTextFromContent(content: ChatMessageContent[]) {
  const textItem = content.find(
    (item): item is Extract<ChatMessageContent, { type: 'text' }> => item.type === 'text' && item.text.trim() !== ''
  )
  if (textItem != null) {
    return textItem.text
  }

  const fileItem = content.find(
    (item): item is Extract<ChatMessageContent, { type: 'file' }> => item.type === 'file' && item.path.trim() !== ''
  )
  if (fileItem != null) {
    return `Context file: ${fileItem.path}`
  }

  const imageItem = content.find((item): item is Extract<ChatMessageContent, { type: 'image' }> =>
    item.type === 'image'
  )
  if (imageItem != null) {
    return imageItem.name?.trim() ? `[图片:${imageItem.name.trim()}]` : '[图片]'
  }

  return undefined
}

export async function processUserMessage(sessionId: string, content: string | ChatMessageContent[]) {
  const serverLogger = getSessionLogger(sessionId, 'server')
  const userText = typeof content === 'string' ? String(content ?? '') : ''
  const contentItems: ChatMessageContent[] = Array.isArray(content)
    ? content
    : [{ type: 'text', text: userText }]
  const summaryText = extractTextFromContent(contentItems) ?? '[内容]'
  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: Array.isArray(content) ? contentItems : userText,
    createdAt: Date.now()
  }

  const ev: WSEvent = { type: 'message', message: userMessage }
  const db = getDb()
  db.saveMessage(sessionId, ev)

  const currentSessionData = db.getSession(sessionId)
  const runtimeState = db.getSessionRuntimeState(sessionId)
  const isExternalSession = runtimeState?.runtimeKind === 'external'
  const updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>> = {
    lastMessage: summaryText,
    lastUserMessage: summaryText,
    status: 'running'
  }

  if (
    currentSessionData?.title == null || currentSessionData.title === '' ||
    currentSessionData.title === 'New Session'
  ) {
    const firstLine = summaryText.split('\n')[0].trim()
    updates.title = firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine
  }

  updateAndNotifySession(sessionId, updates)

  if (listSessionQueuedMessages(sessionId).next.length > 0) {
    armNextQueueInterrupt(sessionId)
  }

  const externalCached = getExternalSessionRuntime(sessionId)
  if (isExternalSession && externalCached != null) {
    broadcastSessionEvent(sessionId, ev)
    return
  }

  let runtime = getAdapterSessionRuntime(sessionId)
  if (runtime == null) {
    serverLogger.info({ sessionId }, '[server] Adapter runtime missing for user message, starting a new process')
    runtime = await startAdapterSession(sessionId)
  }

  if (runtime == null) {
    serverLogger.warn({ sessionId }, '[server] Adapter session not found when processing user message')
    return
  }

  broadcastSessionEvent(sessionId, ev)

  const messageList = db.getMessages(sessionId) as WSEvent[]
  const lastAssistantMessage = messageList
    .filter((m: WSEvent): m is Extract<WSEvent, { type: 'message' }> =>
      m.type === 'message' && m.message.role === 'assistant' && (m.message.id != null && m.message.id !== '')
    )
    .pop()

  const parentUuid = lastAssistantMessage != null ? lastAssistantMessage.message.id : undefined

  runtime.session.emit({
    type: 'message',
    content: contentItems,
    parentUuid: runtime.config?.seededFromHistory === true ? undefined : parentUuid
  })
}

export function updateAndNotifySession(
  id: string,
  updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>
) {
  const db = getDb()
  const previous = db.getSession(id)
  db.updateSession(id, updates)
  const updated = db.getSession(id)
  if (updated) {
    notifySessionUpdated(id, updated)
    void maybeNotifySession(previous?.status, updated.status, updated).catch(() => undefined)
  }
}

export function killSession(sessionId: string) {
  const cached = getAdapterSessionRuntime(sessionId)
  const parked = getExternalSessionRuntime(sessionId)
  const pendingRecovery = clearPendingPermissionRecovery(sessionId)
  const hadPendingInteraction = resolvePendingInteractionAsCancelled(sessionId, pendingRecovery?.interactionId)

  if (cached != null) {
    activeAdapterRunStore.delete(sessionId)
    getSessionLogger(sessionId, 'server').info({ sessionId }, '[server] Killing adapter process by request')
    cached.session.kill()
    deleteAdapterSessionRuntime(sessionId)
  }

  if (parked != null) {
    deleteExternalSessionRuntime(sessionId)
  }

  recentPermissionToolUseStore.delete(sessionId)

  if (cached != null || parked != null || pendingRecovery != null || hadPendingInteraction) {
    updateAndNotifySession(sessionId, { status: 'terminated' })
  }
}

export function interruptSession(sessionId: string) {
  const cached = getAdapterSessionRuntime(sessionId)
  if (cached != null) {
    getSessionLogger(sessionId, 'server').info({ sessionId }, '[server] Interrupting adapter process by request')
    cached.session.emit({ type: 'interrupt' })
  }
}
