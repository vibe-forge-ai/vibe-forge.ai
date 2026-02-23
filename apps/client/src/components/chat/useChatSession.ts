import { App } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSWRConfig } from 'swr'

import type { AskUserQuestionParams, ChatMessage, Session, SessionInfo, WSEvent } from '@vibe-forge/core'
import { useQueryParams } from '#~/hooks/useQueryParams.js'
import { createSession, getSessionMessages } from '../../api'
import { connectionManager } from '../../connectionManager'
import type { ChatHeaderView } from './ChatHeader'

const normalizeView = (value: string): ChatHeaderView => {
  if (value === 'timeline' || value === 'settings' || value === 'history') {
    return value
  }
  return 'history'
}

export function useChatSession({
  session,
  selectedModel,
  hasAvailableModels
}: {
  session?: Session
  selectedModel?: string
  hasAvailableModels: boolean
}) {
  const { message } = App.useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [interactionRequest, setInteractionRequest] = useState<{ id: string; payload: AskUserQuestionParams } | null>(
    null
  )
  const [isCreating, setIsCreating] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const { values: queryValues, update: updateQuery } = useQueryParams<{ view: string }>({
    keys: ['view'],
    defaults: {
      view: 'history'
    },
    omit: {
      view: (value) => value === 'history'
    }
  })
  const activeView = normalizeView(queryValues.view)
  const setActiveView = useCallback((view: ChatHeaderView) => {
    updateQuery({ view })
  }, [updateQuery])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const wasAtBottom = useRef<boolean>(true)
  const isInitialLoadRef = useRef<boolean>(true)
  const lastConnectedModelRef = useRef<string | undefined>(undefined)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const { mutate } = useSWRConfig()

  const isThinking = isCreating || session?.status === 'running'

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior
        })
      }
    }, 50)
  }

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const atBottom = scrollHeight - scrollTop <= clientHeight + 100
      wasAtBottom.current = atBottom
      setShowScrollBottom(!atBottom && scrollHeight > clientHeight)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0) {
      scrollToBottom('auto')
      const timer = setTimeout(() => {
        setIsReady(true)
        isInitialLoadRef.current = false
      }, 50)
      return () => clearTimeout(timer)
    } else if (wasAtBottom.current) {
      scrollToBottom('smooth')
    }
  }, [messages])

  useEffect(() => {
    if (session?.id == null || session.id === '') {
      setMessages([])
      setSessionInfo(null)
      setIsReady(true)
      lastConnectedModelRef.current = undefined
      return
    }

    setMessages([])
    setSessionInfo(null)
    setIsReady(false)
    isInitialLoadRef.current = true

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
        } else {
          setInteractionRequest(null)
        }

        let currentMessages: ChatMessage[] = []
        let currentSessionInfo: SessionInfo | null = null

        for (const data of events) {
          if (data.type === 'message') {
            const exists = currentMessages.find((msg) => msg.id === data.message.id)
            if (exists != null) {
              currentMessages = currentMessages.map((msg) => (msg.id === data.message.id ? data.message : msg))
            } else {
              currentMessages.push(data.message)
            }
          } else if (data.type === 'session_info') {
            if (data.info != null && data.info.type !== 'summary') {
              currentSessionInfo = data.info
            }
          } else if (data.type === 'tool_result') {
            currentMessages = currentMessages.map((msg) => {
              if (msg.toolCall != null && msg.toolCall.id === data.toolCallId) {
                return {
                  ...msg,
                  toolCall: {
                    ...msg.toolCall,
                    status: data.isError === true ? 'error' : 'success',
                    output: data.output
                  }
                }
              }
              return msg
            })
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

    let cleanup: (() => void) | undefined
    const normalizedModel = selectedModel ?? ''
    const modelChanged = selectedModel != null
      && lastConnectedModelRef.current != null
      && normalizedModel !== lastConnectedModelRef.current
      && session?.status !== 'running'
    if (modelChanged) {
      connectionManager.send(session.id, { type: 'terminate_session' })
      connectionManager.close(session.id)
    }
    lastConnectedModelRef.current = normalizedModel

    const timer = setTimeout(() => {
      if (isDisposed) return

      cleanup = connectionManager.connect(session.id, {
        onOpen() {
        },
        onMessage(data: WSEvent) {
          if (isDisposed) return
          if (data.type === 'error') {
            void message.error(data.message)
          } else if (data.type === 'session_updated') {
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
          } else if (data.type === 'message') {
            setMessages((m) => {
              const exists = m.find((msg) => msg.id === data.message.id)
              if (exists != null) {
                return m.map((msg) => (msg.id === data.message.id ? data.message : msg))
              }
              return [...m, data.message]
            })
          } else if (data.type === 'session_info') {
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
          } else if (data.type === 'tool_result') {
            setMessages((m) => {
              return m.map((msg) => {
                if (msg.toolCall != null && msg.toolCall.id === data.toolCallId) {
                  return {
                    ...msg,
                    toolCall: {
                      ...msg.toolCall,
                      status: data.isError === true ? 'error' : 'success',
                      output: data.output
                    }
                  }
                }
                return msg
              })
            })
          } else if (data.type === 'interaction_request') {
            setInteractionRequest({ id: data.id, payload: data.payload })
          }
        },
        onClose() {
        }
      }, selectedModel ? { model: selectedModel } : undefined)
    }, modelChanged ? 200 : 100)

    return () => {
      isDisposed = true
      clearTimeout(timer)
      cleanup?.()
    }
  }, [selectedModel, session?.id, session?.status, mutate])

  useEffect(() => {
    if (activeView !== queryValues.view) {
      updateQuery({ view: activeView })
    }
  }, [activeView, queryValues.view, updateQuery])

  const send = async (text: string) => {
    if (text.trim() === '' || isThinking) return
    if (!hasAvailableModels) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }

    if (!session?.id) {
      setIsCreating(true)
      try {
        const { session: newSession } = await createSession(undefined, text.trim())

        await mutate('/api/sessions', (prev: { sessions: Session[] } | undefined) => {
          if (!prev?.sessions) return { sessions: [newSession] }
          return {
            ...prev,
            sessions: [newSession, ...prev.sessions]
          }
        }, false)

        void navigate(`/session/${newSession.id}`)
      } catch (err) {
        console.error(err)
        setIsCreating(false)
        void message.error('Failed to create session')
      }
      return
    }

    connectionManager.send(session.id, {
      type: 'user_message',
      text: text.trim()
    })
  }

  const interrupt = () => {
    if (!session?.id || isThinking === false) return
    connectionManager.send(session.id, {
      type: 'interrupt'
    })
  }

  const clearMessages = () => {
    setMessages([])
    void message.success('Messages cleared')
  }

  const handleInteractionResponse = (id: string, data: string | string[]) => {
    if (!session?.id) return
    connectionManager.send(session.id, {
      type: 'interaction_response',
      id,
      data
    })
    setInteractionRequest(null)
  }

  return {
    messages,
    sessionInfo,
    interactionRequest,
    isCreating,
    isReady,
    isThinking,
    activeView,
    setActiveView,
    messagesEndRef,
    messagesContainerRef,
    showScrollBottom,
    scrollToBottom,
    send,
    interrupt,
    clearMessages,
    handleInteractionResponse
  }
}
