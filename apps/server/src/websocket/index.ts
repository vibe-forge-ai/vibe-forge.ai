import type { Buffer } from 'node:buffer'
import type { Server } from 'node:http'
import { cwd as processCwd, env as processEnv } from 'node:process'
import { URL } from 'node:url'

import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'

import type {
  AdapterOutputEvent,
  AdapterSession,
  AskUserQuestionParams,
  Config,
  ServerEnv,
  Session,
  SessionInfo,
  SessionStatus,
  WSEvent
} from '@vibe-forge/core'
import { loadConfig, systemController } from '@vibe-forge/core'
import { run } from '@vibe-forge/core/controllers/task'

import { getDb } from '#~/db.js'
import { applySessionEvent } from '#~/services/sessionEvents.js'
import { safeJsonStringify } from '#~/utils/json.js'
import { getSessionLogger } from '#~/utils/logger.js'

function sendToClient(ws: WebSocket, event: WSEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(safeJsonStringify(event))
  }
}

const mergeRecord = <T>(left?: Record<string, T>, right?: Record<string, T>) => {
  if (left == null && right == null) return undefined
  return {
    ...(left ?? {}),
    ...(right ?? {})
  }
}

const getMergedGeneralConfig = async () => {
  const workspaceFolder = processEnv.__VF_PROJECT_WORKSPACE_FOLDER__ ?? processCwd()
  const jsonVariables: Record<string, string | null | undefined> = {
    ...processEnv,
    WORKSPACE_FOLDER: workspaceFolder,
    __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder
  }
  const [projectConfig, userConfig] = await loadConfig({ jsonVariables })
  return {
    interfaceLanguage: userConfig?.interfaceLanguage ?? projectConfig?.interfaceLanguage,
    modelLanguage: userConfig?.modelLanguage ?? projectConfig?.modelLanguage,
    notifications: mergeRecord(
      projectConfig?.notifications as Record<string, unknown> | undefined,
      userConfig?.notifications as Record<string, unknown> | undefined
    ) as Config['notifications']
  }
}

const resolveNotificationText = (
  status: SessionStatus,
  session: Session,
  language: Config['interfaceLanguage']
) => {
  const sessionLabel = session.title && session.title.trim() !== '' ? session.title : session.id
  if (language === 'en') {
    if (status === 'completed') return { title: 'Session completed', description: `Session "${sessionLabel}" completed.` }
    if (status === 'failed') return { title: 'Session failed', description: `Session "${sessionLabel}" failed.` }
    if (status === 'terminated') return { title: 'Session terminated', description: `Session "${sessionLabel}" terminated.` }
    return { title: 'Session needs input', description: `Session "${sessionLabel}" is waiting for input.` }
  }
  if (status === 'completed') return { title: '会话已完成', description: `会话「${sessionLabel}」已完成。` }
  if (status === 'failed') return { title: '会话失败', description: `会话「${sessionLabel}」失败。` }
  if (status === 'terminated') return { title: '会话已终止', description: `会话「${sessionLabel}」已终止。` }
  return { title: '会话等待输入', description: `会话「${sessionLabel}」正在等待输入。` }
}

const maybeNotifySession = async (
  previousStatus: SessionStatus | undefined,
  nextStatus: SessionStatus | undefined,
  session: Session
) => {
  if (nextStatus == null || nextStatus === previousStatus) return
  const { notifications, interfaceLanguage } = await getMergedGeneralConfig()
  if (notifications?.disabled === true) return
  const eventConfig = notifications?.events?.[nextStatus]
  if (eventConfig?.disabled === true) return
  const fallbackText = resolveNotificationText(nextStatus, session, interfaceLanguage)
  const title = eventConfig?.title && eventConfig.title.trim() !== ''
    ? eventConfig.title
    : fallbackText.title
  const description = eventConfig?.description && eventConfig.description.trim() !== ''
    ? eventConfig.description
    : fallbackText.description
  const sound = eventConfig?.sound
  const resolvedSound = typeof sound === 'string' && sound.trim() !== '' ? sound.trim() : undefined
  await systemController.notify({
    title,
    description,
    sound: resolvedSound,
    volume: notifications.volume,
    timeout: false
  })
}

export function broadcastSessionEvent(sessionId: string, event: WSEvent) {
  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    cached.messages.push(event)
    for (const socket of cached.sockets) {
      sendToClient(socket, event)
    }
  }
  const externalCached = externalCache.get(sessionId)
  if (externalCached != null) {
    externalCached.messages.push(event)
    for (const socket of externalCached.sockets) {
      sendToClient(socket, event)
    }
  }
}

// 记录 sessionId 对应的 process (adapter) 和相关的 sockets
// 使用 Map 因为 sessionId 是字符串。如果需要自动清理，我们在 close 时手动处理。
const adapterCache = new Map<string, {
  session: AdapterSession
  sockets: Set<WebSocket>
  messages: WSEvent[]
  currentInteraction?: {
    id: string
    payload: AskUserQuestionParams
  }
}>()

const externalCache = new Map<string, {
  sockets: Set<WebSocket>
  messages: WSEvent[]
  currentInteraction?: {
    id: string
    payload: AskUserQuestionParams
  }
}>()

// Store all connected sockets globally to broadcast session updates
const globalSockets = new Set<WebSocket>()

// Store pending interactions
const pendingInteractions = new Map<string, {
  resolve: (data: string | string[]) => void
  reject: (reason: any) => void
  timer: NodeJS.Timeout
}>()

export function getSessionInteraction(sessionId: string) {
  const cached = adapterCache.get(sessionId)
  if (cached?.currentInteraction != null) {
    return cached.currentInteraction
  }
  return externalCache.get(sessionId)?.currentInteraction
}

export function setSessionInteraction(sessionId: string, interaction: { id: string; payload: AskUserQuestionParams }) {
  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    cached.currentInteraction = interaction
    return
  }
  const externalCached = externalCache.get(sessionId) ?? { sockets: new Set<WebSocket>(), messages: [] }
  externalCached.currentInteraction = interaction
  externalCache.set(sessionId, externalCached)
}

export function clearSessionInteraction(sessionId: string, interactionId: string) {
  const cached = adapterCache.get(sessionId)
  if (cached?.currentInteraction?.id === interactionId) {
    cached.currentInteraction = undefined
    return
  }
  const externalCached = externalCache.get(sessionId)
  if (externalCached?.currentInteraction?.id === interactionId) {
    externalCached.currentInteraction = undefined
  }
}

export function requestInteraction(params: AskUserQuestionParams): Promise<string | string[]> {
  const { sessionId } = params
  const cached = adapterCache.get(sessionId) ?? externalCache.get(sessionId)

  if (cached == null || cached.sockets.size === 0) {
    return Promise.reject(new Error(`Session ${sessionId} is not active`))
  }

  const interactionId = uuidv4()
  const event: WSEvent = {
    type: 'interaction_request',
    id: interactionId,
    payload: params
  }

  cached.currentInteraction = { id: interactionId, payload: params }

  // Broadcast request to all connected sockets for this session
  for (const socket of cached.sockets) {
    sendToClient(socket, event)
  }

  updateAndNotifySession(sessionId, { status: 'waiting_input' })

  return new Promise((resolve, reject) => {
    // 5 minutes timeout
    const timer = setTimeout(() => {
      pendingInteractions.delete(interactionId)
      if (cached.currentInteraction?.id === interactionId) {
        cached.currentInteraction = undefined
      }
      reject(new Error('Interaction timed out'))
    }, 5 * 60 * 1000)

    pendingInteractions.set(interactionId, { resolve, reject, timer })
  })
}

export async function startAdapterSession(
  sessionId: string,
  options: {
    model?: string
    systemPrompt?: string
    appendSystemPrompt?: boolean
  } = {}
) {
  const db = getDb()
  const historyMessages = db.getMessages(sessionId) as WSEvent[]
  const hasHistory = historyMessages.length > 0
  const serverLogger = getSessionLogger(sessionId, 'server')
  const type = hasHistory ? 'resume' : 'create'

  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    serverLogger.info({ sessionId }, '[server] Reusing existing adapter process')
    return cached
  }

  serverLogger.info({ sessionId, type }, '[server] Starting new adapter process')

  // 确保数据库中有该 session
  const existing = db.getSession(sessionId)
  if (existing == null) {
    serverLogger.info({ sessionId }, '[server] Session not found in DB, creating new entry')
    db.createSession(undefined, sessionId)
  }

  const sockets = new Set<WebSocket>()
  const messages: WSEvent[] = []

  // Pre-create the cache entry so onEvent can access it
  // But we can't set the session yet.
  // We'll update the session property later.
  // Actually run() awaits.
  // We can pass the `sockets` set to onEvent via closure.

  try {
    const { modelLanguage } = await getMergedGeneralConfig().catch(() => ({ modelLanguage: undefined }))
    const languagePrompt = modelLanguage == null
      ? undefined
      : (modelLanguage === 'en' ? 'Please respond in English.' : '请使用中文进行对话。')
    const mergedSystemPrompt = [options.systemPrompt, languagePrompt].filter(Boolean).join('\n\n')
    const { session } = await run({
      env: processEnv as Record<string, string>,
      cwd: processCwd()
    }, {
      type,
      runtime: 'server',
      sessionId,
      model: options.model,
      systemPrompt: mergedSystemPrompt,
      appendSystemPrompt: options.appendSystemPrompt ?? true,
      onEvent: (event: AdapterOutputEvent) => {
        const broadcast = (ev: WSEvent) => {
          serverLogger.info({ event: 'broadcast', data: ev }, 'Broadcasting event')
          messages.push(ev)
          for (const socket of sockets) {
            sendToClient(socket, ev)
          }
        }

        const applyEvent = (ev: WSEvent) => {
          applySessionEvent(sessionId, ev, {
            broadcast,
            onSessionUpdated: (session) => {
              notifySessionUpdated(sessionId, session)
            }
          })
        }

        switch (event.type) {
          case 'init':
            if ('model' in (event.data as any)) {
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
              applyEvent({
                type: 'message',
                message: event.data
              })
            }
            break
          case 'exit': {
            const { exitCode, stderr } = event.data as { exitCode: number; stderr: string }
            const errorEvent: WSEvent = {
              type: 'error',
              message: exitCode !== 0
                ? `Process exited with code ${exitCode}, stderr:\n${stderr}`
                : 'Process exited unexpectedly'
            }

            // 更新会话状态
            updateAndNotifySession(sessionId, {
              status: exitCode === 0 ? 'completed' : 'failed'
            })

            for (const socket of sockets) {
              sendToClient(socket, errorEvent)
            }

            // 从缓存中移除
            adapterCache.delete(sessionId)
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
            updateAndNotifySession(sessionId, { status: 'completed' })
            break
          }
        }
      }
    })

    const entry = { session, sockets, messages }
    adapterCache.set(sessionId, entry)
    return entry
  } catch (err) {
    serverLogger.error({ err, sessionId }, '[server] session init error')
    throw err
  }
}

export function processUserMessage(sessionId: string, text: string) {
  const serverLogger = getSessionLogger(sessionId, 'server')
  const userText = String(text ?? '')
  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: userText,
    createdAt: Date.now()
  }

  // 存入历史并广播
  const ev: WSEvent = { type: 'message', message: userMessage }
  const db = getDb()
  db.saveMessage(sessionId, ev)

  // 记录最后一条用户消息和最后一条消息到数据库，并同步更新标题（如果尚未设置）
  const currentSessionData = db.getSession(sessionId)
  const updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>> = {
    lastMessage: userText,
    lastUserMessage: userText,
    status: 'running'
  }

  if (
    currentSessionData?.title == null || currentSessionData.title === '' ||
    currentSessionData.title === 'New Session'
  ) {
    // 提取第一行或者前50个字符作为标题
    const firstLine = userText.split('\n')[0].trim()
    updates.title = firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine
  }

  updateAndNotifySession(sessionId, updates)

  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    cached.messages.push(ev)
    for (const socket of cached.sockets) {
      sendToClient(socket, ev)
    }

    const messageList = cached.messages

    // 获取最后一条助手消息的 id (即 uuid) 作为 parentUuid
    const lastAssistantMessage = messageList
      .filter((m: WSEvent): m is Extract<WSEvent, { type: 'message' }> =>
        m.type === 'message' && m.message.role === 'assistant' && (m.message.id != null && m.message.id !== '')
      )
      .pop()

    const parentUuid = lastAssistantMessage != null ? lastAssistantMessage.message.id : undefined

    cached.session.emit({
      type: 'message',
      content: [{ type: 'text', text: userText }],
      parentUuid
    })
  } else {
    const externalCached = externalCache.get(sessionId)
    if (externalCached != null) {
      externalCached.messages.push(ev)
      for (const socket of externalCached.sockets) {
        sendToClient(socket, ev)
      }
      return
    }
    serverLogger.warn({ sessionId }, '[server] Adapter session not found when processing user message')
  }
}

export function setupWebSocket(server: Server, env: ServerEnv) {
  const wss = new WebSocketServer({ server, path: env.__VF_PROJECT_AI_SERVER_WS_PATH__ })

  wss.on('connection', async (ws, req) => {
    globalSockets.add(ws)
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
    const params = url.searchParams

    const sessionId = params.get('sessionId') ?? uuidv4()
    const model = params.get('model') ?? undefined
    const systemPrompt = params.get('systemPrompt') ?? undefined
    const appendSystemPrompt = params.get('appendSystemPrompt') !== 'false'

    const serverLogger = getSessionLogger(sessionId, 'server')
    serverLogger.info({ sessionId }, '[server] Connection established')

    try {
      const db = getDb()
      const sessionData = db.getSession(sessionId)
      const isExternalSession = sessionData?.parentSessionId != null

      if (isExternalSession) {
        const externalCached = externalCache.get(sessionId) ?? { sockets: new Set<WebSocket>(), messages: [] }
        externalCached.sockets.add(ws)
        externalCache.set(sessionId, externalCached)
      } else {
        const cached = await startAdapterSession(sessionId, {
          model,
          systemPrompt,
          appendSystemPrompt
        })
        cached.sockets.add(ws)
      }
    } catch (err) {
      sendToClient(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) })
      return
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any

        if (msg.type === 'interaction_response') {
          const { id, data } = msg
          const sessionData = getDb().getSession(sessionId)
          const isExternalSession = sessionData?.parentSessionId != null
          if (isExternalSession) {
            clearSessionInteraction(sessionId, id)
            const event: WSEvent = { type: 'interaction_response', id, data }
            applySessionEvent(sessionId, event, {
              broadcast: (ev) => broadcastSessionEvent(sessionId, ev),
              onSessionUpdated: (session) => {
                notifySessionUpdated(sessionId, session)
              }
            })
            return
          }
          const pending = pendingInteractions.get(id)

          if (pending) {
            clearTimeout(pending.timer)
            clearSessionInteraction(sessionId, id)
            updateAndNotifySession(sessionId, { status: 'running' })
            pending.resolve(data)
            pendingInteractions.delete(id)
          }
          return
        }

        serverLogger.info({ event: 'user_input', data: msg }, 'Received user message')
        if (msg.type === 'user_message') {
          processUserMessage(sessionId, msg.text)
        } else if (msg.type === 'interrupt') {
          serverLogger.info({ sessionId }, '[server] Received interrupt request')
          const sessionData = getDb().getSession(sessionId)
          if (sessionData?.parentSessionId == null) {
            const cached = adapterCache.get(sessionId)
            if (cached != null) {
              cached.session.emit({ type: 'interrupt' })
            }
          }
        } else if (msg.type === 'terminate_session') {
          serverLogger.info({ sessionId }, '[server] Received terminate_session request')
          killSession(sessionId)
        }
      } catch (err) {
        sendToClient(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    })

    ws.on('close', () => {
      globalSockets.delete(ws)
      const cached = adapterCache.get(sessionId)
      if (cached != null) {
        cached.sockets.delete(ws)
        if (cached.sockets.size === 0) {
          serverLogger.info({ sessionId }, '[server] All sockets closed, but keeping adapter process alive')
        } else {
          serverLogger.info(
            { sessionId, activeSockets: cached.sockets.size },
            '[server] Socket closed, but session still has active sockets'
          )
        }
        return
      }
      const externalCached = externalCache.get(sessionId)
      if (externalCached != null) {
        externalCached.sockets.delete(ws)
        if (externalCached.sockets.size === 0) {
          externalCache.delete(sessionId)
        }
      }
    })
  })

  return wss
}

export function notifySessionUpdated(sessionId: string, session: Session | { id: string; isDeleted: boolean }) {
  const event: WSEvent = { type: 'session_updated', session }
  for (const socket of globalSockets) {
    sendToClient(socket, event)
  }
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
  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    getSessionLogger(sessionId, 'server').info({ sessionId }, '[server] Killing adapter process by request')
    cached.session.kill()
    adapterCache.delete(sessionId)
    updateAndNotifySession(sessionId, { status: 'terminated' })
  }
}
