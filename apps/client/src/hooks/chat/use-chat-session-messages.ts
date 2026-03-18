import { App } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSWRConfig } from 'swr'

import { getSessionMessages } from '#~/api.js'
import { connectionManager } from '#~/connectionManager.js'
import type { AskUserQuestionParams, ChatMessage, Session, SessionInfo, WSEvent } from '@vibe-forge/core'
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
  permissionMode,
  adapter,
  setInteractionRequest
}: {
  session?: Session
  modelForQuery?: string
  permissionMode: PermissionMode
  adapter?: string
  setInteractionRequest: (value: { id: string; payload: AskUserQuestionParams } | null) => void
}) {
  const { t } = useTranslation()
  const { mutate } = useSWRConfig()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const isInitialLoadRef = useRef<boolean>(true)
  const lastConnectedModelRef = useRef<string | undefined>(undefined)
  const lastConnectedPermissionModeRef = useRef<string | undefined>(undefined)
  const lastConnectedAdapterRef = useRef<string | undefined>(undefined)
  const expectedCloseRef = useRef(false)

  const retryConnection = useCallback(() => {
    if (session?.id == null || session.id === '') return
    expectedCloseRef.current = true
    setConnectionError(null)
    connectionManager.close(session.id)
    setRetryCount((count) => count + 1)
  }, [session?.id])

  useEffect(() => {
    setMessages([])
    setSessionInfo(null)
    setIsReady(false)
    setConnectionError(null)
    setInteractionRequest(null)
    isInitialLoadRef.current = true

    if (session?.id == null || session.id === '') {
      setIsReady(true)
      lastConnectedModelRef.current = undefined
      lastConnectedPermissionModeRef.current = undefined
      lastConnectedAdapterRef.current = undefined
      return
    }

    let isDisposed = false

    const fetchHistory = async () => {
      try {
        const res = await getSessionMessages(session.id)
        if (isDisposed) return
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

        if (res.interaction) {
          setInteractionRequest(res.interaction)
        }

        let currentMessages: ChatMessage[] = []
        let currentSessionInfo: SessionInfo | null = null

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

        setTimeout(() => {
          if (isDisposed) return
          setIsReady(true)
          isInitialLoadRef.current = false
        }, 100)
      } catch (err) {
        console.error('Failed to fetch history messages:', err)
      }
    }

    void fetchHistory()

    return () => {
      isDisposed = true
    }
  }, [mutate, session?.id, setInteractionRequest])

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
    if (modelChanged || permissionModeChanged || adapterChanged) {
      expectedCloseRef.current = true
      setConnectionError(null)
      connectionManager.send(session.id, { type: 'terminate_session' })
      connectionManager.close(session.id)
    }
    lastConnectedModelRef.current = normalizedModel
    lastConnectedPermissionModeRef.current = normalizedPermissionMode
    lastConnectedAdapterRef.current = normalizedAdapter

    const timer = setTimeout(() => {
      if (isDisposed) return

      const connectionParams: Record<string, string> = {}
      if (modelForQuery) {
        connectionParams.model = modelForQuery
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
          setConnectionError(null)
        },
        onMessage(data: WSEvent) {
          if (isDisposed) return
          if (data.type === 'error') {
            setConnectionError(data.message)
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
            setInteractionRequest({ id: data.id, payload: data.payload })
          }
        },
        onError() {
          if (isDisposed) return
          setConnectionError(t('chat.connectionError'))
        },
        onClose() {
          if (isDisposed) return
          if (expectedCloseRef.current) {
            expectedCloseRef.current = false
            return
          }
          setConnectionError((current) => current ?? t('chat.connectionClosed'))
        }
      }, Object.keys(connectionParams).length > 0 ? connectionParams : undefined)
    }, modelChanged ? 200 : 100)

    return () => {
      isDisposed = true
      clearTimeout(timer)
      cleanup?.()
    }
  }, [
    adapter,
    modelForQuery,
    mutate,
    permissionMode,
    retryCount,
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
    connectionError,
    retryConnection
  }
}
