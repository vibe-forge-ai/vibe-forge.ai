import './Chat.scss'

import { message } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'

import type { ChatMessage, Session, SessionInfo } from '#~/types'
import { createSocket } from '#~/ws'

import { ChatHeader } from './chat/ChatHeader'
import { CurrentTodoList } from './chat/CurrentTodoList'
import { MessageItem } from './chat/MessageItem'
import { Sender } from './chat/Sender'

export function Chat({
  session,
  renderLeftHeader
}: {
  session?: Session
  renderLeftHeader?: React.ReactNode
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const wasAtBottom = useRef<boolean>(true)
  const isInitialLoadRef = useRef<boolean>(true)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const { mutate } = useSWRConfig()

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
      // Small delay to ensure rendering is complete before showing
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
    if (!session?.id) return

    setMessages([])
    setSessionInfo(null)
    setIsReady(false)
    isInitialLoadRef.current = true

    let isDisposed = false
    const timer = setTimeout(() => {
      if (isDisposed) return

      const ws = createSocket({
        onOpen() {
          // Connected
        },
        onMessage(data) {
          if (isDisposed) return
          console.log('[Chat] Received message:', data.type, data)
          if (data.type === 'error') {
            message.error(data.message)
            setIsThinking(false)
          } else if (data.type === 'message') {
            if (data.message.role === 'assistant') {
              setIsThinking(false)
            }
            setMessages((m) => {
              const exists = m.find((msg) => msg.id === data.message.id)
              if (exists) {
                return m.map((msg) => (msg.id === data.message.id ? data.message : msg))
              }
              return [...m, data.message as ChatMessage]
            })
          } else if (data.type === 'session_info') {
            if (data.info?.type === 'summary') {
              // 触发 SWR 重新加载侧边栏会话列表，以显示最新标题
              mutate('/api/sessions')
            } else {
              setSessionInfo(data.info)
              // If it's a new session with no messages, ready it
              if (isInitialLoadRef.current) {
                setTimeout(() => {
                  if (isInitialLoadRef.current) {
                    setIsReady(true)
                    isInitialLoadRef.current = false
                  }
                }, 100)
              }
            }
          } else if (data.type === 'tool_result') {
            setIsThinking(false)
            setMessages((m) => {
              return m.map((msg) => {
                if (msg.toolCall && msg.toolCall.id === data.toolCallId) {
                  return {
                    ...msg,
                    toolCall: {
                      ...msg.toolCall,
                      status: data.isError ? 'error' : 'success',
                      output: data.output
                    }
                  }
                }
                return msg
              })
            })
          }
        },
        onClose() {
          if (isDisposed) return
          setIsThinking(false)
        }
      }, { sessionId: session.id })

      wsRef.current = ws
    }, 100)

    return () => {
      isDisposed = true
      clearTimeout(timer)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [session?.id])

  const send = (text: string) => {
    if (!wsRef.current || !text.trim() || isThinking) return

    setIsThinking(true)
    wsRef.current.send(JSON.stringify({
      type: 'user_message',
      text: text.trim()
    }))
  }

  const interrupt = () => {
    if (!wsRef.current || !isThinking) return
    wsRef.current.send(JSON.stringify({
      type: 'interrupt'
    }))
    setIsThinking(false)
  }

  return (
    <div className='chat-container'>
      <ChatHeader
        sessionInfo={sessionInfo}
        sessionId={session?.id}
        renderLeft={renderLeftHeader}
      />

      <div className={`chat-messages ${isReady ? 'ready' : ''}`} ref={messagesContainerRef}>
        {messages.map((msg, index) => {
          if (!msg) return null
          try {
            const isFirstInGroup = index === 0 || (messages[index - 1] && messages[index - 1].role !== msg.role)
            return (
              <MessageItem
                key={msg.id || index}
                msg={msg}
                isFirstInGroup={isFirstInGroup}
                allMessages={messages}
                index={index}
              />
            )
          } catch (err) {
            console.error('[Chat] Error rendering message:', err, msg)
            return null
          }
        })}
        <div ref={messagesEndRef} />

        {showScrollBottom && (
          <div className='scroll-bottom-btn' onClick={() => scrollToBottom()}>
            <span className='material-symbols-outlined'>arrow_downward</span>
          </div>
        )}
      </div>

      <CurrentTodoList messages={messages} />
      <Sender
        onSend={send}
        isThinking={isThinking}
        onInterrupt={interrupt}
        sessionInfo={sessionInfo}
      />
    </div>
  )
}
