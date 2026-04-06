import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSWRConfig } from 'swr'

import { getSessionMessages } from '#~/api.js'
import { connectionManager } from '#~/connectionManager.js'
import type { AskUserQuestionParams, ChatMessage, Session, WSEvent } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'
import {
  applyInteractionStateEvent,
  findLatestFatalError,
  getFatalSessionError,
  type ChatErrorBannerState,
  restoreInteractionStateFromHistory
} from './interaction-state'
import type { ChatEffort } from './use-chat-effort'
import type { PermissionMode } from './use-chat-permission-mode'

const applyMessageEvent = (currentMessages: ChatMessage[], data: WSEvent) => {
  if (data.type !== 'message') return currentMessages
  const exists = currentMessages.find((msg) => msg.id === data.message.id)
  if (exists != null) {
    return currentMessages.map((msg) => (msg.id === data.message.id ? data.message : msg))
  }
  return [...currentMessages, data.message]
}

const applyToolResultEvent = (currentMessages: ChatMessage[], data: WSEvent): ChatMessage[] => {
  if (data.type !== 'tool_result') return currentMessages
  const status = data.isError === true ? 'error' : 'success'
  return currentMessages.map((msg) => {
    if (msg.toolCall != null && msg.toolCall.id === data.toolCallId) {
      return {
        ...msg,
        toolCall: {
          ...msg.toolCall,
          status,
          output: data.output
        }
      }
    }
    return msg
  })
}

export function useChatSessionMessages({
  session,
  modelForQuery,
  effort,
  permissionMode,
  adapter,
  setInteractionRequest
}: {
  session?: Session
  modelForQuery?: string
  effort: ChatEffort
  permissionMode: PermissionMode
  adapter?: string
  setInteractionRequest: (value: { id: string; payload: AskUserQuestionParams } | null) => void
}) {
  const { t } = useTranslation()
  const { mutate } = useSWRConfig()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [errorBanner, setErrorBanner] = useState<ChatErrorBannerState | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const isInitialLoadRef = useRef<boolean>(true)
  const lastConnectedModelRef = useRef<string | undefined>(undefined)
  const lastConnectedEffortRef = useRef<string | undefined>(undefined)
  const lastConnectedPermissionModeRef = useRef<string | undefined>(undefined)
  const lastConnectedAdapterRef = useRef<string | undefined>(undefined)
  const lastObservedSessionStatusRef = useRef<Session['status'] | undefined>(session?.status)
  const expectedCloseRef = useRef(false)
  const interactionRequestRef = useRef<{ id: string; payload: AskUserQuestionParams } | null>(null)
  const activeSessionIdRef = useRef<string | undefined>(session?.id)
  const historyRequestSeqRef = useRef(0)
  const reconcileTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])

  activeSessionIdRef.current = session?.id

  const clearScheduledReconciles = useCallback(() => {
    for (const timer of reconcileTimersRef.current) {
      clearTimeout(timer)
    }
    reconcileTimersRef.current = []
  }, [])

  const refreshHistory = useCallback(async (options: { updateReadiness?: boolean } = {}) => {
    const sessionId = activeSessionIdRef.current
    if (sessionId == null || sessionId === '') {
      return
    }

    const requestSeq = ++historyRequestSeqRef.current

    try {
      const res = await getSessionMessages(sessionId)
      if (activeSessionIdRef.current !== sessionId || historyRequestSeqRef.current !== requestSeq) {
        return
      }

      const events = res.messages as WSEvent[]

      if (res.session) {
        const updatedSession = res.session
        void mutate('/api/sessions', (prev: { sessions: Session[] } | undefined) => {
          if (prev?.sessions == null) return prev
          const newSessions = prev.sessions.map((s: Session) =>
            s.id === updatedSession.id ? { ...s, ...updatedSession } : s
          )
          return { ...prev, sessions: newSessions }
        }, false)
      }

      let currentMessages: ChatMessage[] = []
      let currentSessionInfo: SessionInfo | null = null
      const restoredInteraction = restoreInteractionStateFromHistory(
        events,
        res.interaction ?? null,
        res.session?.status
      )
      const latestFatalError = findLatestFatalError(events)

      interactionRequestRef.current = restoredInteraction
      setInteractionRequest(restoredInteraction)
      setErrorBanner(restoredInteraction == null && res.session?.status === 'failed' && latestFatalError != null
        ? {
            kind: 'session',
            message: latestFatalError.message
          }
        : null)

      for (const data of events) {
        currentMessages = applyMessageEvent(currentMessages, data)
        currentMessages = applyToolResultEvent(currentMessages, data)
        if (data.type === 'session_info') {
          if (data.info != null && data.info.type !== 'summary') {
            currentSessionInfo = data.info
          }
        }
      }

      setMessages(currentMessages)
      setSessionInfo(currentSessionInfo)

      if (options.updateReadiness !== false) {
        setTimeout(() => {
          if (activeSessionIdRef.current !== sessionId || historyRequestSeqRef.current !== requestSeq) {
            return
          }
          setIsReady(true)
          isInitialLoadRef.current = false
        }, 100)
      }
    } catch (err) {
      console.error('Failed to fetch history messages:', err)
    }
  }, [mutate, setInteractionRequest])

  const reconcileAfterInteraction = useCallback(() => {
    clearScheduledReconciles()

    for (const delay of [0, 800, 2400, 5000, 9000, 15000]) {
      const timer = globalThis.setTimeout(() => {
        void refreshHistory({ updateReadiness: false })
      }, delay)
      reconcileTimersRef.current.push(timer)
    }
  }, [clearScheduledReconciles, refreshHistory])

  const retryConnection = useCallback(() => {
    if (session?.id == null || session.id === '') return
    expectedCloseRef.current = true
    setErrorBanner(null)
    connectionManager.close(session.id)
    setRetryCount((count) => count + 1)
  }, [session?.id])

  useEffect(() => {
    setMessages([])
    setSessionInfo(null)
    setIsReady(false)
    setErrorBanner(null)
    setInteractionRequest(null)
    interactionRequestRef.current = null
    isInitialLoadRef.current = true

    if (session?.id == null || session.id === '') {
      setIsReady(true)
      lastConnectedModelRef.current = undefined
      lastConnectedEffortRef.current = undefined
      lastConnectedPermissionModeRef.current = undefined
      lastConnectedAdapterRef.current = undefined
      clearScheduledReconciles()
      return
    }

    void refreshHistory()

    return () => {
      clearScheduledReconciles()
    }
  }, [clearScheduledReconciles, refreshHistory, session?.id, setInteractionRequest])

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      lastObservedSessionStatusRef.current = undefined
      return
    }

    const previousStatus = lastObservedSessionStatusRef.current
    lastObservedSessionStatusRef.current = session.status

    if (previousStatus == null || previousStatus === session.status) {
      return
    }

    void refreshHistory({ updateReadiness: false })
  }, [refreshHistory, session?.id, session?.status])

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      return
    }

    let isDisposed = false
    let cleanup: (() => void) | undefined
    const normalizedModel = modelForQuery ?? ''
    const modelChanged = modelForQuery != null &&
      lastConnectedModelRef.current != null &&
      normalizedModel !== lastConnectedModelRef.current &&
      session?.status !== 'running'
    const normalizedEffort = effort === 'default' ? '' : effort
    const effortChanged = lastConnectedEffortRef.current != null &&
      normalizedEffort !== lastConnectedEffortRef.current &&
      session?.status !== 'running'
    const normalizedPermissionMode = permissionMode ?? ''
    const permissionModeChanged = permissionMode != null &&
      lastConnectedPermissionModeRef.current != null &&
      normalizedPermissionMode !== lastConnectedPermissionModeRef.current &&
      session?.status !== 'running'
    const normalizedAdapter = adapter ?? ''
    const adapterChanged = adapter != null &&
      lastConnectedAdapterRef.current != null &&
      normalizedAdapter !== lastConnectedAdapterRef.current &&
      session?.status !== 'running'
    if (modelChanged || effortChanged || permissionModeChanged || adapterChanged) {
      expectedCloseRef.current = true
      setErrorBanner(null)
      connectionManager.send(session.id, { type: 'terminate_session' })
      connectionManager.close(session.id)
    }
    lastConnectedModelRef.current = normalizedModel
    lastConnectedEffortRef.current = normalizedEffort
    lastConnectedPermissionModeRef.current = normalizedPermissionMode
    lastConnectedAdapterRef.current = normalizedAdapter

    const timer = setTimeout(() => {
      if (isDisposed) return

      const connectionParams: Record<string, string> = {}
      if (modelForQuery) {
        connectionParams.model = modelForQuery
      }
      if (effort !== 'default') {
        connectionParams.effort = effort
      }
      if (permissionMode) {
        connectionParams.permissionMode = permissionMode
      }
      if (adapter) {
        connectionParams.adapter = adapter
      }

        cleanup = connectionManager.connect(session.id, {
        onOpen() {
          expectedCloseRef.current = false
          setErrorBanner((current) => current?.kind === 'session' ? current : null)
        },
        onMessage(data: WSEvent) {
          if (isDisposed) return
          const nextInteraction = applyInteractionStateEvent(interactionRequestRef.current, data)
          if (nextInteraction !== interactionRequestRef.current) {
            interactionRequestRef.current = nextInteraction
            setInteractionRequest(nextInteraction)
            if (nextInteraction != null) {
              setErrorBanner(null)
            }
          }
          if (data.type === 'interaction_response') {
            reconcileAfterInteraction()
            return
          }
          if (data.type === 'error') {
            const fatalError = getFatalSessionError(data)
            if (fatalError != null) {
              setErrorBanner({
                kind: 'session',
                message: fatalError.message
              })
            }
            return
          }

          if (data.type === 'session_updated') {
            void mutate('/api/sessions', (prev: { sessions: Session[] } | undefined) => {
              if (prev?.sessions == null) return prev
              const updatedSession = data.session as Session | { id: string; isDeleted: boolean }

              if ('isDeleted' in updatedSession && updatedSession.isDeleted) {
                return {
                  ...prev,
                  sessions: prev.sessions.filter((s: Session) => s.id !== updatedSession.id)
                }
              }

              const typedUpdatedSession = updatedSession as Session
              const newSessions = prev.sessions.map((s: Session) =>
                s.id === typedUpdatedSession.id ? { ...s, ...typedUpdatedSession } : s
              )

              if (
                !newSessions.some((s: Session) => s.id === typedUpdatedSession.id) && !('isDeleted' in updatedSession)
              ) {
                newSessions.unshift(typedUpdatedSession)
              }

              return { ...prev, sessions: newSessions }
            }, false)
            return
          }

          if (data.type === 'message') {
            setMessages((current) => applyMessageEvent(current, data))
            return
          }

          if (data.type === 'session_info') {
            if (data.info != null && data.info.type === 'summary') {
              void mutate('/api/sessions')
            } else {
              setSessionInfo(data.info ?? null)
              if (isInitialLoadRef.current) {
                setTimeout(() => {
                  if (isDisposed) return
                  if (isInitialLoadRef.current) {
                    setIsReady(true)
                    isInitialLoadRef.current = false
                  }
                }, 100)
              }
            }
            return
          }

          if (data.type === 'tool_result') {
            setMessages((current) => applyToolResultEvent(current, data))
            return
          }

          if (data.type === 'interaction_request') {
            setInteractionRequest(data)
          }
        },
        onError() {
          if (isDisposed) return
          setErrorBanner({
            kind: 'connection',
            message: t('chat.connectionError')
          })
        },
        onClose() {
          if (isDisposed) return
          if (expectedCloseRef.current) {
            expectedCloseRef.current = false
            return
          }
          setErrorBanner((current) => current ?? {
            kind: 'connection',
            message: t('chat.connectionClosed')
          })
        }
      }, Object.keys(connectionParams).length > 0 ? connectionParams : undefined)
    }, (modelChanged || effortChanged || permissionModeChanged || adapterChanged) ? 200 : 100)

    return () => {
      isDisposed = true
      clearTimeout(timer)
      cleanup?.()
    }
  }, [
    adapter,
    clearScheduledReconciles,
    effort,
    modelForQuery,
    mutate,
    permissionMode,
    reconcileAfterInteraction,
    retryCount,
    refreshHistory,
    session?.id,
    session?.status,
    setInteractionRequest,
    t
  ])

  return {
    messages,
    setMessages,
    sessionInfo,
    isReady,
    errorBanner,
    retryConnection,
    reconcileAfterInteraction
  }
}
