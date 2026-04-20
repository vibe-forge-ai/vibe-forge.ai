import { useCallback, useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useSWRConfig } from 'swr'

import type { AskUserQuestionParams, ChatMessage, Session, SessionMessageQueueState, WSEvent } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'

import { getSessionMessages } from '#~/api.js'
import { connectionManager } from '#~/connectionManager.js'

import type { ChatErrorState, InteractionRequestState } from './interaction-state'
import {
  applyInteractionStateEvent,
  findLatestFatalError,
  getFatalSessionError,
  restoreInteractionStateFromHistory
} from './interaction-state'
import type { OptimisticSessionCreation } from './optimistic-session-creation'
import {
  deleteChatSessionViewSnapshot,
  restoreChatSessionViewSnapshot,
  setChatSessionViewSnapshot
} from './session-view-cache'
import type { ChatSessionViewSnapshot } from './session-view-cache'
import type { ChatEffort } from './use-chat-effort'
import type { PermissionMode } from './use-chat-permission-mode'

const EMPTY_QUEUED_MESSAGES: SessionMessageQueueState = { steer: [], next: [] }

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
  account,
  optimisticCreation,
  setInteractionRequest
}: {
  session?: Session
  modelForQuery?: string
  effort: ChatEffort
  permissionMode: PermissionMode
  adapter?: string
  account?: string
  optimisticCreation?: OptimisticSessionCreation
  setInteractionRequest: (value: { id: string; payload: AskUserQuestionParams } | null) => void
}) {
  const { t } = useTranslation()
  const { mutate } = useSWRConfig()
  const [messagesState, setMessagesState] = useState<ChatMessage[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [queuedMessages, setQueuedMessages] = useState<SessionMessageQueueState>({ steer: [], next: [] })
  const [isReady, setIsReady] = useState(false)
  const [errorState, setErrorState] = useState<ChatErrorState | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const isInitialLoadRef = useRef<boolean>(true)
  const lastConnectedModelRef = useRef<string | undefined>(undefined)
  const lastConnectedEffortRef = useRef<string | undefined>(undefined)
  const lastConnectedPermissionModeRef = useRef<string | undefined>(undefined)
  const lastConnectedAdapterRef = useRef<string | undefined>(undefined)
  const lastConnectedAccountRef = useRef<string | undefined>(undefined)
  const lastObservedSessionStatusRef = useRef<Session['status'] | undefined>(session?.status)
  const expectedCloseRef = useRef(false)
  const interactionRequestRef = useRef<InteractionRequestState | null>(null)
  const activeSessionIdRef = useRef<string | undefined>(session?.id)
  const historyRequestSeqRef = useRef(0)
  const reconcileTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const sessionViewCacheRef = useRef(new Map<string, ChatSessionViewSnapshot>())

  activeSessionIdRef.current = session?.id

  const updateSessionViewCache = useCallback((
    sessionId: string,
    patch: Partial<{
      messages: ChatMessage[]
      sessionInfo: SessionInfo | null
      queuedMessages: SessionMessageQueueState
      errorState: ChatErrorState | null
      interactionRequest: InteractionRequestState | null
      isHydrated: boolean
    }>
  ) => {
    return setChatSessionViewSnapshot(sessionViewCacheRef.current, sessionId, patch)
  }, [])

  const removeSessionViewCache = useCallback((sessionId: string) => {
    deleteChatSessionViewSnapshot(sessionViewCacheRef.current, sessionId)
  }, [])

  const setMessages = useCallback((value: SetStateAction<ChatMessage[]>) => {
    setMessagesState((current) => {
      const next = typeof value === 'function'
        ? value(current)
        : value
      const sessionId = activeSessionIdRef.current

      if (sessionId != null && sessionId !== '') {
        const currentSnapshot = sessionViewCacheRef.current.get(sessionId)
        updateSessionViewCache(sessionId, {
          messages: next,
          isHydrated: currentSnapshot?.isHydrated === true
        })
      }

      return next
    })
  }, [updateSessionViewCache])

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
      const nextErrorState = restoredInteraction == null && res.session?.status === 'failed' && latestFatalError != null
        ? {
          kind: 'session' as const,
          message: latestFatalError.message,
          code: latestFatalError.code
        }
        : null
      const nextQueuedMessages = res.queuedMessages ?? EMPTY_QUEUED_MESSAGES

      interactionRequestRef.current = restoredInteraction
      setInteractionRequest(restoredInteraction)
      setQueuedMessages(nextQueuedMessages)
      setErrorState(nextErrorState)

      for (const data of events) {
        currentMessages = applyMessageEvent(currentMessages, data)
        currentMessages = applyToolResultEvent(currentMessages, data)
        if (data.type === 'session_info') {
          if (data.info != null && data.info.type !== 'summary') {
            currentSessionInfo = data.info
          }
        }
      }

      updateSessionViewCache(sessionId, {
        messages: currentMessages,
        sessionInfo: currentSessionInfo,
        queuedMessages: nextQueuedMessages,
        errorState: nextErrorState,
        interactionRequest: restoredInteraction,
        isHydrated: true
      })

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
  }, [mutate, setInteractionRequest, setMessages, updateSessionViewCache])

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
    setErrorState(null)
    updateSessionViewCache(session.id, { errorState: null })
    connectionManager.close(session.id)
    setRetryCount((count) => count + 1)
  }, [session?.id, updateSessionViewCache])

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      setMessagesState([])
      setSessionInfo(null)
      setQueuedMessages(EMPTY_QUEUED_MESSAGES)
      setIsReady(true)
      setErrorState(null)
      setInteractionRequest(null)
      interactionRequestRef.current = null
      isInitialLoadRef.current = true
      lastConnectedModelRef.current = undefined
      lastConnectedEffortRef.current = undefined
      lastConnectedPermissionModeRef.current = undefined
      lastConnectedAdapterRef.current = undefined
      lastConnectedAccountRef.current = undefined
      clearScheduledReconciles()
      return
    }

    if (optimisticCreation != null) {
      clearScheduledReconciles()
      historyRequestSeqRef.current += 1
      const nextMessages = [optimisticCreation.message]
      const nextErrorState = optimisticCreation.status === 'failed'
        ? {
          action: 'retry-session-creation',
          code: 'session_create_failed',
          kind: 'session',
          message: optimisticCreation.errorMessage ?? t('chat.sessionCreateFailedMessage')
        } satisfies ChatErrorState
        : null

      interactionRequestRef.current = null
      setInteractionRequest(null)
      setMessagesState(nextMessages)
      setSessionInfo(null)
      setQueuedMessages(EMPTY_QUEUED_MESSAGES)
      setErrorState(nextErrorState)
      setIsReady(true)
      isInitialLoadRef.current = false
      updateSessionViewCache(session.id, {
        messages: nextMessages,
        sessionInfo: null,
        queuedMessages: EMPTY_QUEUED_MESSAGES,
        errorState: nextErrorState,
        interactionRequest: null,
        isHydrated: true
      })
      return
    }

    const restoredState = restoreChatSessionViewSnapshot(sessionViewCacheRef.current.get(session.id))

    setMessagesState(restoredState.messages)
    setSessionInfo(restoredState.sessionInfo)
    setQueuedMessages(restoredState.queuedMessages)
    setErrorState(restoredState.errorState)
    setInteractionRequest(restoredState.interactionRequest)
    interactionRequestRef.current = restoredState.interactionRequest
    setIsReady(restoredState.isReady)
    isInitialLoadRef.current = !restoredState.isReady

    void refreshHistory()

    return () => {
      clearScheduledReconciles()
    }
  }, [
    clearScheduledReconciles,
    optimisticCreation,
    refreshHistory,
    session?.id,
    setInteractionRequest,
    t,
    updateSessionViewCache
  ])

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      lastObservedSessionStatusRef.current = undefined
      return
    }
    if (optimisticCreation != null) {
      lastObservedSessionStatusRef.current = session.status
      return
    }

    const previousStatus = lastObservedSessionStatusRef.current
    lastObservedSessionStatusRef.current = session.status

    if (previousStatus == null || previousStatus === session.status) {
      return
    }

    void refreshHistory({ updateReadiness: false })
  }, [optimisticCreation, refreshHistory, session?.id, session?.status])

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      return
    }
    if (optimisticCreation != null) {
      expectedCloseRef.current = true
      connectionManager.close(session.id)
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
    const normalizedAccount = account ?? ''
    const accountChanged = account != null &&
      lastConnectedAccountRef.current != null &&
      normalizedAccount !== lastConnectedAccountRef.current &&
      session?.status !== 'running'
    if (modelChanged || effortChanged || permissionModeChanged || adapterChanged || accountChanged) {
      expectedCloseRef.current = true
      setErrorState(null)
      connectionManager.send(session.id, { type: 'terminate_session' })
      connectionManager.close(session.id)
    }
    lastConnectedModelRef.current = normalizedModel
    lastConnectedEffortRef.current = normalizedEffort
    lastConnectedPermissionModeRef.current = normalizedPermissionMode
    lastConnectedAdapterRef.current = normalizedAdapter
    lastConnectedAccountRef.current = normalizedAccount

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
      if (account) {
        connectionParams.account = account
      }

      cleanup = connectionManager.connect(session.id, {
        onOpen() {
          expectedCloseRef.current = false
          setErrorState((current) => {
            const next = current?.kind === 'session' ? current : null
            updateSessionViewCache(session.id, {
              errorState: next
            })
            return next
          })
        },
        onMessage(data: WSEvent) {
          if (isDisposed) return
          const nextInteraction = applyInteractionStateEvent(interactionRequestRef.current, data)
          if (nextInteraction !== interactionRequestRef.current) {
            interactionRequestRef.current = nextInteraction
            setInteractionRequest(nextInteraction)
            updateSessionViewCache(session.id, {
              interactionRequest: nextInteraction
            })
            if (nextInteraction != null) {
              setErrorState(null)
              updateSessionViewCache(session.id, {
                errorState: null
              })
            }
          }
          if (data.type === 'interaction_response') {
            reconcileAfterInteraction()
            return
          }
          if (data.type === 'error') {
            const fatalError = getFatalSessionError(data)
            if (fatalError != null) {
              const nextErrorState = {
                kind: 'session',
                message: fatalError.message,
                code: fatalError.code
              } satisfies ChatErrorState
              setErrorState(nextErrorState)
              updateSessionViewCache(session.id, {
                errorState: nextErrorState
              })
            }
            return
          }

          if (data.type === 'session_updated') {
            void mutate('/api/sessions', (prev: { sessions: Session[] } | undefined) => {
              if (prev?.sessions == null) return prev
              const updatedSession = data.session as Session | { id: string; isDeleted: boolean }

              if ('isDeleted' in updatedSession && updatedSession.isDeleted) {
                removeSessionViewCache(updatedSession.id)
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

          if (data.type === 'session_queue_updated') {
            setQueuedMessages(data.queue)
            updateSessionViewCache(session.id, {
              queuedMessages: data.queue
            })
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
              updateSessionViewCache(session.id, {
                sessionInfo: data.info ?? null
              })
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
            interactionRequestRef.current = data
            setInteractionRequest(data)
            updateSessionViewCache(session.id, {
              interactionRequest: data
            })
          }
        },
        onError() {
          if (isDisposed) return
          const nextErrorState = {
            kind: 'connection',
            message: t('chat.connectionError'),
            reason: 'error'
          } satisfies ChatErrorState
          setErrorState(nextErrorState)
          updateSessionViewCache(session.id, {
            errorState: nextErrorState
          })
        },
        onClose() {
          if (isDisposed) return
          if (expectedCloseRef.current) {
            expectedCloseRef.current = false
            return
          }
          setErrorState((current) => {
            const next = current ?? {
              kind: 'connection',
              message: t('chat.connectionClosed'),
              reason: 'closed'
            }
            updateSessionViewCache(session.id, {
              errorState: next
            })
            return next
          })
        }
      }, Object.keys(connectionParams).length > 0 ? connectionParams : undefined)
    }, (modelChanged || effortChanged || permissionModeChanged || adapterChanged || accountChanged) ? 200 : 100)

    return () => {
      isDisposed = true
      clearTimeout(timer)
      cleanup?.()
    }
  }, [
    adapter,
    account,
    clearScheduledReconciles,
    effort,
    modelForQuery,
    mutate,
    optimisticCreation,
    permissionMode,
    reconcileAfterInteraction,
    retryCount,
    refreshHistory,
    session?.id,
    session?.status,
    setInteractionRequest,
    t,
    removeSessionViewCache,
    updateSessionViewCache
  ])

  return {
    messages: messagesState,
    setMessages,
    sessionInfo,
    queuedMessages,
    isReady,
    errorState,
    retryConnection,
    reconcileAfterInteraction
  }
}
