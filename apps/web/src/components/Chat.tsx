import './Chat.scss'

import { App } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useSWR, { useSWRConfig } from 'swr'

import type {
  AskUserQuestionParams,
  ChatMessage,
  ConfigResponse,
  ModelServiceConfig,
  RecommendedModelConfig,
  Session,
  SessionInfo,
  WSEvent
} from '@vibe-forge/core'
import { createSession, getConfig, getSessionMessages } from '../api'
import { connectionManager } from '../connectionManager'

import type { ChatHeaderView } from './chat/ChatHeader'
import { ChatHeader, SessionSettingsPanel } from './chat/ChatHeader'
import { CurrentTodoList } from './chat/CurrentTodoList'
import { MessageItem } from './chat/MessageItem'
import { NewSessionGuide } from './chat/NewSessionGuide'
import { SessionTimelinePanel } from './chat/SessionTimelinePanel'
import { Sender } from './chat/Sender'
import { ToolGroup } from './chat/ToolGroup'
import { processMessages } from './chat/messageUtils'

export function Chat({
  session
}: {
  session?: Session
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
  const [activeView, setActiveView] = useState<ChatHeaderView>('history')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const wasAtBottom = useRef<boolean>(true)
  const isInitialLoadRef = useRef<boolean>(true)
  const lastConnectedModelRef = useRef<string | undefined>(undefined)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const { mutate } = useSWRConfig()
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)

  const isThinking = isCreating || session?.status === 'running'

  const mergedModelServices = React.useMemo(() => {
    const services = configRes?.sources?.merged?.modelServices
    return (services ?? {}) as Record<string, ModelServiceConfig>
  }, [configRes?.sources?.merged?.modelServices])

  const recommendedModels = React.useMemo(() => {
    const raw = configRes?.sources?.merged?.general?.recommendedModels
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is RecommendedModelConfig => (
      item != null && typeof item === 'object' && typeof item.model === 'string' && item.model.trim() !== ''
    ))
  }, [configRes?.sources?.merged?.general?.recommendedModels])

  const modelServiceEntries = React.useMemo(() => Object.entries(mergedModelServices), [mergedModelServices])

  const availableModels = React.useMemo(() => {
    const list: Array<{ model: string; serviceKey: string; serviceTitle: string }> = []
    for (const [serviceKey, serviceValue] of modelServiceEntries) {
      const service = (serviceValue != null && typeof serviceValue === 'object') ? serviceValue as ModelServiceConfig : undefined
      const serviceTitle = service?.title?.trim() !== '' ? service?.title ?? '' : serviceKey
      const models = Array.isArray(service?.models) ? service?.models.filter(item => typeof item === 'string') : []
      for (const model of models) {
        list.push({ model, serviceKey, serviceTitle })
      }
    }
    return list
  }, [modelServiceEntries])

  const availableModelValues = React.useMemo(() => availableModels.map(item => item.model), [availableModels])
  const availableModelKey = React.useMemo(() => availableModelValues.join('|'), [availableModelValues])
  const availableModelSet = React.useMemo(() => new Set(availableModelValues), [availableModelKey])
  const hasAvailableModels = availableModelValues.length > 0
  const defaultModelService = configRes?.sources?.merged?.general?.defaultModelService
  const defaultModel = configRes?.sources?.merged?.general?.defaultModel
  const resolvedDefaultModel = React.useMemo(() => {
    if (!hasAvailableModels) return undefined
    if (defaultModel && availableModelSet.has(defaultModel)) return defaultModel
    if (defaultModelService && mergedModelServices[defaultModelService]) {
      const service = mergedModelServices[defaultModelService]
      const models = Array.isArray(service?.models) ? service?.models.filter(item => typeof item === 'string') : []
      if (models.length > 0) return models[0]
    }
    return availableModelValues[0]
  }, [availableModelSet, availableModelValues, defaultModel, defaultModelService, hasAvailableModels, mergedModelServices])

  useEffect(() => {
    if (!hasAvailableModels) {
      setSelectedModel(undefined)
      return
    }
    setSelectedModel((prev) => {
      if (prev != null && availableModelSet.has(prev)) return prev
      return resolvedDefaultModel
    })
  }, [availableModelSet, hasAvailableModels, resolvedDefaultModel])

  const modelOptions = React.useMemo(() => {
    const buildOption = (params: {
      value: string
      title: string
      description?: string
      serviceKey?: string
      serviceTitle?: string
    }) => {
      const description = params.description?.trim()
      const label = (
        <div className='model-option'>
          <div className='model-option-title'>{params.title}</div>
          {description && <div className='model-option-desc'>{description}</div>}
        </div>
      )
      const searchText = [
        params.title,
        params.value,
        params.serviceTitle,
        params.serviceKey,
        description
      ]
        .filter(Boolean)
        .join(' ')
      return {
        value: params.value,
        label,
        searchText
      }
    }

    const modelToService = new Map<string, { key: string; title: string }>()
    for (const entry of availableModels) {
      if (!modelToService.has(entry.model)) {
        modelToService.set(entry.model, { key: entry.serviceKey, title: entry.serviceTitle })
      }
    }

    const resolveFirstAlias = (modelsAlias: Record<string, string[]> | undefined, model: string) => {
      if (!modelsAlias) return undefined
      for (const [alias, aliasModels] of Object.entries(modelsAlias)) {
        if (!Array.isArray(aliasModels)) continue
        if (aliasModels.includes(model)) return alias
      }
      return undefined
    }

    const serviceGroups = modelServiceEntries
      .map(([serviceKey, serviceValue]) => {
        const service = (serviceValue != null && typeof serviceValue === 'object') ? serviceValue as ModelServiceConfig : undefined
        const serviceTitle = service?.title?.trim() !== '' ? service?.title ?? '' : serviceKey
        const groupTitle = serviceTitle?.trim() !== '' ? serviceTitle : serviceKey
        const serviceDescription = service?.description
        const models = Array.isArray(service?.models) ? service?.models.filter(item => typeof item === 'string') : []
        if (models.length === 0) return null
        const options = models.map((model) => {
          const alias = resolveFirstAlias(service?.modelsAlias as Record<string, string[]> | undefined, model)
          const title = alias ?? model
          const description = alias ? model : serviceTitle
          return buildOption({
            value: model,
            title,
            description,
            serviceKey,
            serviceTitle
          })
        })
        return {
          label: (
            <div className='model-group-label'>
              <div className='model-group-title'>{groupTitle}</div>
              {serviceDescription && <div className='model-group-desc'>{serviceDescription}</div>}
            </div>
          ),
          options
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)

    const recommendedOptions = recommendedModels
      .filter((item) => {
        if (item.placement && item.placement !== 'modelSelector') return false
        return availableModelSet.has(item.model)
      })
      .map((item) => {
        const serviceInfo = item.service ? mergedModelServices[item.service] : undefined
        const serviceTitle = item.service
          ? (serviceInfo?.title?.trim() !== '' ? serviceInfo?.title ?? '' : item.service)
          : modelToService.get(item.model)?.title
        const alias = item.service
          ? resolveFirstAlias(serviceInfo?.modelsAlias as Record<string, string[]> | undefined, item.model)
          : undefined
        const title = item.title?.trim() !== '' ? item.title ?? '' : (alias ?? item.model)
        const description = item.description?.trim() !== ''
          ? item.description
          : serviceTitle
        return buildOption({
          value: item.model,
          title,
          description,
          serviceKey: item.service ?? modelToService.get(item.model)?.key,
          serviceTitle
        })
      })

    const groups = []
    if (recommendedOptions.length > 0) {
      const recommendedTitle = t('chat.modelGroupRecommended', { defaultValue: '推荐模型' })
      groups.push({
        label: (
          <div className='model-group-label'>
            <div className='model-group-title'>{recommendedTitle}</div>
          </div>
        ),
        options: recommendedOptions
      })
    }
    return [...groups, ...serviceGroups]
  }, [availableModelSet, availableModels, mergedModelServices, modelServiceEntries, recommendedModels, t])

  const renderItems = React.useMemo(() => processMessages(messages), [messages])

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
    setActiveView('history')
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

    // 获取历史消息
    const fetchHistory = async () => {
      try {
        const res = await getSessionMessages(session.id)
        if (isDisposed) return
        const events = res.messages as WSEvent[]

        // 如果后端返回了最新的 session 状态，更新 SWR 缓存
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

        // 标记为就绪，允许显示界面
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
          // Connected
        },
        onMessage(data: WSEvent) {
          if (isDisposed) return
          if (data.type === 'error') {
            void message.error(data.message)
          } else if (data.type === 'session_updated') {
            // 更新 SWR 缓存中的会话列表
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

              // 如果是新会话（不在列表中），则添加进去
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
              // 触发 SWR 重新加载侧边栏会话列表，以显示最新标题
              void mutate('/api/sessions')
            } else {
              setSessionInfo(data.info ?? null)
              // If it's a new session with no messages, ready it
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
          // No-op
        }
      }, selectedModel ? { model: selectedModel } : undefined)
    }, modelChanged ? 200 : 100)

    return () => {
      isDisposed = true
      clearTimeout(timer)
      cleanup?.()
    }
  }, [selectedModel, session?.id, session?.status, mutate])

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

  return (
    <div className={`chat-container ${isReady ? 'ready' : ''} ${!session?.id ? 'is-new-session' : ''}`}>
      {session?.id && (
        <ChatHeader
          sessionInfo={sessionInfo}
          sessionId={session?.id}
          sessionTitle={session?.title}
          isStarred={session?.isStarred}
          isArchived={session?.isArchived}
          tags={session?.tags}
          lastMessage={session?.lastMessage}
          lastUserMessage={session?.lastUserMessage}
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}

      {activeView === 'history' && (
        <>
          <div className={`chat-messages ${isReady ? 'ready' : ''}`} ref={messagesContainerRef}>
            {renderItems.map((item, index) => {
              if (item.type === 'message') {
                return (
                  <MessageItem
                    key={item.message.id || index}
                    msg={item.message}
                    isFirstInGroup={item.isFirstInGroup}
                  />
                )
              } else if (item.type === 'tool-group') {
                return (
                  <ToolGroup
                    key={item.id || `group-${index}`}
                    items={item.items}
                    footer={item.footer}
                  />
                )
              }
              return null
            })}
            <div ref={messagesEndRef} />

            {showScrollBottom && (
              <div className='scroll-bottom-btn' onClick={() => scrollToBottom()}>
                <span className='material-symbols-rounded'>arrow_downward</span>
              </div>
            )}
          </div>

          {!session?.id && (
            <div className='new-session-guide-wrapper'>
              <NewSessionGuide />
            </div>
          )}

          <CurrentTodoList messages={messages} />
          <div className='sender-container'>
            <Sender
              onSend={send}
              sessionStatus={isCreating ? 'running' : session?.status}
              onInterrupt={interrupt}
              onClear={clearMessages}
              sessionInfo={sessionInfo}
              interactionRequest={interactionRequest}
              onInteractionResponse={handleInteractionResponse}
              placeholder={!session?.id ? t('chat.newSessionPlaceholder') : undefined}
              modelOptions={modelOptions}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              modelUnavailable={!hasAvailableModels}
            />
          </div>
        </>
      )}

      {activeView === 'timeline' && (
        <SessionTimelinePanel messages={messages} isThinking={isThinking} />
      )}

      {activeView === 'settings' && session?.id && (
        <div className='chat-settings-panel'>
          <SessionSettingsPanel
            sessionId={session?.id}
            initialTitle={session?.title}
            initialTags={session?.tags}
            isStarred={session?.isStarred}
            isArchived={session?.isArchived}
            onClose={() => setActiveView('history')}
          />
        </div>
      )}
    </div>
  )
}
