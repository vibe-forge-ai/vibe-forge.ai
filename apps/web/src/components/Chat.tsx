import './Chat.scss'

import { message } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'

import type { ChatMessage, Session, SessionInfo, WSEvent } from '@vibe-forge/core'
import { createSocket } from '../ws'

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
    if (session?.id == null || session.id === '') return

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
        onMessage(data: WSEvent) {
          if (isDisposed) return
          if (data.type === 'error') {
            void message.error(data.message)
            setIsThinking(false)
          } else if (data.type === 'message') {
            if (data.message.role === 'assistant') {
              setIsThinking(false)
            }
            setMessages((m) => {
              const exists = m.find((msg) => msg.id === data.message.id)
              if (exists != null) {
                return m.map((msg) => (msg.id === data.message.id ? data.message : msg))
              }
              return [...m, data.message]
            })
          } else if (data.type === 'session_info') {
            if (data.info != null && data.info.type === 'summary') {
              // 触发 SWR 重新加载侧边栏会话列表，以显示最新标题
              void mutate('/api/sessions')
            } else {
              setSessionInfo(data.info ?? null)
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
      if (wsRef.current != null) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [session?.id, mutate])

  const send = (text: string) => {
    if (wsRef.current == null || text.trim() === '' || isThinking) return

    setIsThinking(true)
    wsRef.current.send(JSON.stringify({
      type: 'user_message',
      text: text.trim()
    }))
  }

  const interrupt = () => {
    if (wsRef.current == null || isThinking === false) return
    wsRef.current.send(JSON.stringify({
      type: 'interrupt'
    }))
    setIsThinking(false)
  }

  const clearMessages = () => {
    setMessages([])
    void message.success('Messages cleared')
  }

  return (
    <div className='chat-container'>
      <ChatHeader
        sessionInfo={sessionInfo}
        sessionId={session?.id}
        sessionTitle={session?.title}
        renderLeft={renderLeftHeader}
      />

      <div className={`chat-messages ${isReady ? 'ready' : ''}`} ref={messagesContainerRef}>
        {messages.map((msg, index) => {
          if (msg == null) return null
          try {
            const prevMsg = messages[index - 1]
            const isFirstInGroup = index === 0 || (prevMsg != null && prevMsg.role !== msg.role)
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
        onClear={clearMessages}
        sessionInfo={sessionInfo}
      />
    </div>
  )
}
