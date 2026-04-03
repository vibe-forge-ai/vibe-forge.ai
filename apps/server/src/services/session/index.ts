import { cwd as processCwd, env as processEnv } from 'node:process'

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
import type { AdapterErrorData, AdapterOutputEvent, SessionInfo } from '@vibe-forge/types'

import { handleChannelSessionEvent } from '#~/channels/index.js'
import { getDb } from '#~/db/index.js'
import { loadConfigState } from '#~/services/config/index.js'
import { applySessionEvent } from '#~/services/session/events.js'
import { canRequestInteraction, requestInteraction } from '#~/services/session/interaction.js'
import { maybeNotifySession } from '#~/services/session/notification.js'
import type { AdapterSessionRuntime } from '#~/services/session/runtime.js'
import {
  bindAdapterSessionRuntime,
  broadcastSessionEvent,
  createSessionConnectionState,
  deleteAdapterSessionRuntime,
  emitRuntimeEvent,
  getAdapterSessionRuntime,
  getExternalSessionRuntime,
  notifySessionUpdated,
  parkAdapterSessionRuntime,
  setAdapterSessionRuntime,
  takeExternalSessionRuntime
} from '#~/services/session/runtime.js'
import { getSessionLogger } from '#~/utils/logger.js'

const activeAdapterRunStore = new Map<string, string>()
export const adapterSessionStartStore = new Map<string, Promise<AdapterSessionRuntime>>()
const pendingPermissionRecoveryStore = new Map<string, { runId: string }>()
const PERMISSION_REQUIRED_CODE = 'permission_required'
const PERMISSION_DECISION_CANCEL = 'cancel'

const buildPermissionRecoveryPrompt = (params: {
  adapter?: string
  currentMode?: SessionPermissionMode
  error: AdapterErrorData
}) => {
  if (params.currentMode === 'bypassPermissions') {
    return undefined
  }

  const details = params.error.details != null && typeof params.error.details === 'object'
    ? params.error.details as Record<string, unknown>
    : undefined
  const permissionDenials = Array.isArray(details?.permissionDenials)
    ? details.permissionDenials as Array<Record<string, unknown>>
    : []
  const deniedTools = [
    ...new Set(
      permissionDenials.flatMap((entry) => Array.isArray(entry?.deniedTools) ? entry.deniedTools : [])
    )
  ]
  const reasons = [
    ...new Set(
      permissionDenials
        .map((entry) => typeof entry?.message === 'string' ? entry.message.trim() : '')
        .filter(message => message !== '')
    )
  ]
  const suggestedMode: SessionPermissionMode = params.currentMode === 'dontAsk' ? 'bypassPermissions' : 'dontAsk'

  return {
    sessionId: '',
    kind: 'permission' as const,
    question: deniedTools.length > 0
      ? `当前任务需要额外权限才能继续，涉及工具：${deniedTools.join('、')}。是否授权后继续？`
      : '当前任务需要额外权限才能继续。是否授权后继续？',
    options: [
      {
        label: `继续并切换到 ${suggestedMode}`,
        value: suggestedMode,
        description: suggestedMode === 'dontAsk'
          ? '尽量直接执行，不再额外询问。'
          : '跳过大部分权限检查，风险最高。'
      },
      ...(suggestedMode === 'dontAsk'
        ? [{
          label: '继续并切换到 bypassPermissions',
          value: 'bypassPermissions',
          description: '跳过大部分权限检查，风险最高。'
        }]
        : []),
      {
        label: '取消',
        value: PERMISSION_DECISION_CANCEL,
        description: '保持当前权限模式，结束这次被拦截的操作。'
      }
    ],
    permissionContext: {
      adapter: params.adapter,
      currentMode: params.currentMode,
      suggestedMode,
      deniedTools,
      reasons
    }
  }
}

const resolvePermissionDecision = (
  answer: string | string[],
  options: Array<{ label: string; value?: string }>
): SessionPermissionMode | typeof PERMISSION_DECISION_CANCEL | undefined => {
  const normalizedAnswer = Array.isArray(answer) ? answer[0] : answer
  if (typeof normalizedAnswer !== 'string') return undefined

  const raw = normalizedAnswer.trim()
  if (raw === '') return undefined

  const matched = options.find(option => option.label === raw || option.value === raw)
  const resolved = matched?.value ?? matched?.label ?? raw

  if (resolved === PERMISSION_DECISION_CANCEL) return PERMISSION_DECISION_CANCEL
  if (
    resolved === 'default' ||
    resolved === 'acceptEdits' ||
    resolved === 'plan' ||
    resolved === 'dontAsk' ||
    resolved === 'bypassPermissions'
  ) {
    return resolved
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

export async function startAdapterSession(
  sessionId: string,
  options: {
    model?: string
    effort?: EffortLevel
    systemPrompt?: string
    appendSystemPrompt?: boolean
    permissionMode?: SessionPermissionMode
    promptType?: 'spec' | 'entity'
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
      const configChanged = currentModel !== resolvedModel ||
        currentAdapter !== resolvedAdapter ||
        currentEffort !== resolvedEffort ||
        currentPermissionMode !== resolvedPermissionMode

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
        resolvedPermissionMode
      }, '[server] Restarting adapter process due to session config change')
      activeAdapterRunStore.delete(sessionId)
      cached.session.kill()
      deleteAdapterSessionRuntime(sessionId)
    }

    serverLogger.info({ sessionId, type }, '[server] Starting new adapter process')

    if (existing == null) {
      serverLogger.info({ sessionId }, '[server] Session not found in DB, creating new entry')
      db.createSession(undefined, sessionId, undefined, undefined, {
        runtimeKind: 'interactive'
      })
    }

    if (
      resolvedModel !== existing?.model || resolvedAdapter !== existing?.adapter ||
      resolvedEffort !== existing?.effort ||
      resolvedPermissionMode !== existing?.permissionMode
    ) {
      updateAndNotifySession(sessionId, {
        model: resolvedModel,
        adapter: resolvedAdapter,
        effort: resolvedEffort,
        permissionMode: resolvedPermissionMode
      })
    }

    const connectionState = takeExternalSessionRuntime(sessionId) ?? createSessionConnectionState()
    const runId = uuidv4()
    activeAdapterRunStore.set(sessionId, runId)

    try {
      const promptCwd = processCwd()
      const [data, resolvedConfig] = await generateAdapterQueryOptions(
        options.promptType,
        options.promptName,
        promptCwd
      )
      const env = {
        ...processEnv,
        __VF_PROJECT_AI_CTX_ID__: processEnv.__VF_PROJECT_AI_CTX_ID__ ?? sessionId
      }
      const finalSystemPrompt = options.appendSystemPrompt === false
        ? (options.systemPrompt ?? resolvedConfig.systemPrompt)
        : [resolvedConfig.systemPrompt, options.systemPrompt]
          .filter(Boolean)
          .join('\n\n')
      const { mergedConfig } = await loadConfigState().catch(() => ({ mergedConfig: {} as { modelLanguage?: string } }))
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

      const { session } = await run({
        env,
        cwd: promptCwd,
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
                updateAndNotifySession(sessionId, {
                  model: typeof (event.data as any).model === 'string'
                    ? (event.data as any).model
                    : resolvedModel,
                  adapter: typeof (event.data as any).adapter === 'string'
                    ? (event.data as any).adapter
                    : resolvedAdapter,
                  effort: resolvedEffort,
                  permissionMode: resolvedPermissionMode
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
              }
              break
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
                const permissionPrompt = buildPermissionRecoveryPrompt({
                  adapter: resolvedAdapter,
                  currentMode: resolvedPermissionMode,
                  error: event.data
                })

                if (permissionPrompt != null) {
                  pendingPermissionRecoveryStore.set(sessionId, { runId })
                  void requestInteraction({
                    ...permissionPrompt,
                    sessionId
                  })
                    .then(async (answer) => {
                      if (pendingPermissionRecoveryStore.get(sessionId)?.runId !== runId) {
                        return
                      }

                      pendingPermissionRecoveryStore.delete(sessionId)
                      const nextPermissionMode = resolvePermissionDecision(answer, permissionPrompt.options ?? [])
                      if (nextPermissionMode == null || nextPermissionMode === PERMISSION_DECISION_CANCEL) {
                        emitSessionError(sessionId, {
                          message: '用户取消了本次权限授权，任务未继续执行。',
                          code: 'permission_request_declined',
                          fatal: true
                        })
                        return
                      }

                      try {
                        updateAndNotifySession(sessionId, {
                          permissionMode: nextPermissionMode,
                          status: 'running'
                        })
                        const recovered = await startAdapterSession(sessionId, {
                          permissionMode: nextPermissionMode
                        })
                        recovered.session.emit({
                          type: 'message',
                          content: [
                            {
                              type: 'text',
                              text:
                                `权限模式已更新为 ${nextPermissionMode}。请继续刚才被权限拦截的工作，并重试被阻止的操作。`
                            }
                          ]
                        })
                      } catch (error) {
                        emitSessionError(sessionId, {
                          message: '权限已更新，但恢复会话失败。',
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

              updateAndNotifySession(sessionId, {
                status: exitCode === 0 ? 'completed' : 'failed'
              })
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
              }
              break
            }
          }
        }
      })

      if (seededFromHistory) {
        db.updateSessionRuntimeState(sessionId, { historySeedPending: false })
      }

      return setAdapterSessionRuntime(
        sessionId,
        bindAdapterSessionRuntime(connectionState, session, {
          runId,
          model: resolvedModel,
          adapter: resolvedAdapter,
          effort: resolvedEffort,
          permissionMode: resolvedPermissionMode,
          seededFromHistory
        })
      )
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
  return textItem?.text
}

export async function processUserMessage(sessionId: string, content: string | ChatMessageContent[]) {
  const serverLogger = getSessionLogger(sessionId, 'server')
  const userText = typeof content === 'string' ? String(content ?? '') : ''
  const contentItems: ChatMessageContent[] = Array.isArray(content)
    ? content
    : [{ type: 'text', text: userText }]
  const summaryText = extractTextFromContent(contentItems) ?? '[图片]'
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
  if (cached != null) {
    activeAdapterRunStore.delete(sessionId)
    getSessionLogger(sessionId, 'server').info({ sessionId }, '[server] Killing adapter process by request')
    cached.session.kill()
    deleteAdapterSessionRuntime(sessionId)
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
