import { App } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'

import type { AskUserQuestionParams, ChatMessage, Session, SessionInfo, WSEvent } from '@vibe-forge/core'
import { getSessionMessages } from '#~/api.js'
import { connectionManager } from '#~/connectionManager.js'
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
  setInteractionRequest
}: {
  session?: Session
  modelForQuery?: string
  permissionMode: PermissionMode
  setInteractionRequest: (value: { id: string; payload: AskUserQuestionParams } | null) => void
}) {
  const { message } = App.useApp()
  const { mutate } = useSWRConfig()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [isReady, setIsReady] = useState(false)
  const isInitialLoadRef = useRef<boolean>(true)
  const lastConnectedModelRef = useRef<string | undefined>(undefined)
  const lastConnectedPermissionModeRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    setMessages([])
    setSessionInfo(null)
    setIsReady(false)
    setInteractionRequest(null)
    isInitialLoadRef.current = true

    if (session?.id == null || session.id === '') {
      setIsReady(true)
      lastConnectedModelRef.current = undefined
      lastConnectedPermissionModeRef.current = undefined
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
    if (modelChanged || permissionModeChanged) {
      connectionManager.send(session.id, { type: 'terminate_session' })
      connectionManager.close(session.id)
    }
    lastConnectedModelRef.current = normalizedModel
    lastConnectedPermissionModeRef.current = normalizedPermissionMode

    const timer = setTimeout(() => {
      if (isDisposed) return

      const connectionParams: Record<string, string> = {}
    if (modelForQuery) {
      connectionParams.model = modelForQuery
      }
      if (permissionMode) {
        connectionParams.permissionMode = permissionMode
      }

      cleanup = connectionManager.connect(session.id, {
        onOpen() {
        },
        onMessage(data: WSEvent) {
          if (isDisposed) return
          if (data.type === 'error') {
            void message.error(data.message)
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
        onClose() {
        }
      }, Object.keys(connectionParams).length > 0 ? connectionParams : undefined)
    }, modelChanged ? 200 : 100)

    return () => {
      isDisposed = true
      clearTimeout(timer)
      cleanup?.()
    }
  }, [message, modelForQuery, mutate, permissionMode, session?.id, session?.status, setInteractionRequest])

  return {
    messages,
    setMessages,
    sessionInfo,
    isReady
  }
}
