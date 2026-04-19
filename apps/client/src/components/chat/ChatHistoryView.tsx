import { App } from 'antd'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import useSWR from 'swr'

import type {
  AskUserQuestionParams,
  ChatMessage,
  ChatMessageContent,
  Session,
  SessionMessageQueueState,
  SessionQueuedMessage,
  SessionQueuedMessageMode
} from '@vibe-forge/core'
import type { ConfigResponse, SessionInfo } from '@vibe-forge/types'

import { getConfig } from '#~/api'
import { ComposerLanding, ComposerStack } from '#~/components/composer-landing/ComposerLanding'
import type { ContextReferenceRequest } from '#~/components/workspace/context-file-types'
import {
  DEFAULT_CHAT_SESSION_TARGET_DRAFT,
  getChatSessionTargetDraftFromSession,
  isChatSessionTargetReady
} from '#~/hooks/chat/chat-session-target'
import type { ChatSessionTargetDraft } from '#~/hooks/chat/chat-session-target'
import {
  DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT,
  getChatSessionWorkspaceDraftFromConfig
} from '#~/hooks/chat/chat-session-workspace-draft'
import type { ChatAdapterAccountOption } from '#~/hooks/chat/use-chat-adapter-account-selection'
import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useChatScroll } from '#~/hooks/chat/use-chat-scroll'
import { useChatSessionActions } from '#~/hooks/chat/use-chat-session-actions'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { getLoopedIndex } from '#~/hooks/use-roving-focus-list'
import { CurrentTodoList } from './CurrentTodoList'
import { NewSessionGuide } from './NewSessionGuide'
import { QueuedMessagesCard } from './QueuedMessagesCard'
import { MessageItem } from './messages/MessageItem'
import { MessageStatusNotice } from './messages/MessageStatusNotice'
import type { ChatHistoryStatusNotice } from './messages/build-chat-history-status-notices'
import { buildMessageTurns } from './messages/message-turns'
import { processMessages } from './messages/message-utils'
import { SenderInteractionPanel } from './sender/@components/sender-interaction-panel/SenderInteractionPanel'
import { Sender } from './sender/Sender'
import { ChatStatusBar } from './status-bar/ChatStatusBar'
import { ToolGroup } from './tools/core/ToolGroup'

export function ChatHistoryView({
  isReady,
  messages,
  session,
  targetMessageId,
  targetToolUseId,
  sessionInfo,
  historyStatusNotices,
  queuedMessages,
  onRetryConnection,
  interactionRequest,
  onInteractionResponse,
  setMessages,
  onClearMessages,
  placeholder,
  modelMenuGroups,
  modelSearchOptions,
  recommendedModelOptions,
  servicePreviewModelOptions,
  onToggleRecommendedModel,
  updatingRecommendedModelValue,
  selectedModel,
  modelForQuery,
  onModelChange,
  effort,
  effortOptions,
  onEffortChange,
  permissionMode,
  permissionModeOptions,
  onPermissionModeChange,
  selectedAdapter,
  adapterOptions,
  onAdapterChange,
  selectedAccount,
  accountOptions,
  showAccountSelector,
  onAccountChange,
  modelUnavailable,
  hasAvailableModels,
  contextReferenceRequest
}: {
  isReady: boolean
  messages: ChatMessage[]
  session?: Session
  targetMessageId?: string
  targetToolUseId?: string
  sessionInfo: SessionInfo | null
  historyStatusNotices: ChatHistoryStatusNotice[]
  queuedMessages: SessionMessageQueueState
  onRetryConnection: () => void
  interactionRequest: { id: string; payload: AskUserQuestionParams } | null
  onInteractionResponse: (id: string, data: string | string[]) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  onClearMessages: () => void
  placeholder?: string
  modelMenuGroups: ModelSelectMenuGroup[]
  modelSearchOptions: ModelSelectOption[]
  recommendedModelOptions: ModelSelectOption[]
  servicePreviewModelOptions: ModelSelectOption[]
  onToggleRecommendedModel: (option: ModelSelectOption) => void | Promise<void>
  updatingRecommendedModelValue?: string
  selectedModel?: string
  modelForQuery?: string
  onModelChange: (model: string) => void
  effort: ChatEffort
  effortOptions: Array<{ value: ChatEffort; label: React.ReactNode }>
  onEffortChange: (effort: ChatEffort) => void
  permissionMode: PermissionMode
  permissionModeOptions: Array<{ value: PermissionMode; label: React.ReactNode }>
  onPermissionModeChange: (mode: PermissionMode) => void
  selectedAdapter?: string
  adapterOptions: Array<{ value: string; label: React.ReactNode }>
  onAdapterChange: (adapter: string) => void
  selectedAccount?: string
  accountOptions: ChatAdapterAccountOption[]
  showAccountSelector: boolean
  onAccountChange: (account: string) => void
  modelUnavailable: boolean
  hasAvailableModels: boolean
  contextReferenceRequest?: ContextReferenceRequest | null
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const location = useLocation()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)
  const configWorkspaceDraft = useMemo(
    () => getChatSessionWorkspaceDraftFromConfig(configRes),
    [configRes]
  )
  const workspaceDraftDirtyRef = useRef(false)
  const [sessionTargetDraft, setSessionTargetDraft] = useState<ChatSessionTargetDraft>(() => ({
    ...DEFAULT_CHAT_SESSION_TARGET_DRAFT
  }))
  const [workspaceDraft, setWorkspaceDraft] = useState(() => ({
    ...DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT
  }))
  const historyRenderCount = messages.length + historyStatusNotices.length
  const { messagesEndRef, messagesContainerRef, messagesContentRef, showScrollBottom, scrollToBottom } = useChatScroll({
    contentVersion: historyRenderCount
  })
  const {
    isCreating,
    send,
    sendContent,
    enqueueContent,
    removeQueuedContent,
    moveQueuedContent,
    reorderQueuedContent,
    editMessage,
    forkMessage,
    interrupt,
    clearMessages,
    recallMessage
  } = useChatSessionActions({
    session,
    modelForQuery,
    hasAvailableModels,
    effort,
    permissionMode,
    adapter: selectedAdapter,
    account: selectedAccount,
    sessionTargetDraft,
    workspaceDraft,
    onClearMessages
  })
  const initialScrollDoneRef = useRef(false)
  const handledHashAnchorIdRef = useRef('')
  const handledTargetScrollKeyRef = useRef('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [expandedTurnIds, setExpandedTurnIds] = useState<Set<string>>(new Set())
  const [queueMode, setQueueMode] = useState<SessionQueuedMessageMode>('steer')
  const [queuedDraft, setQueuedDraft] = useState<{ content: ChatMessageContent[] } | null>(null)
  const [activeInteractionOptionIndex, setActiveInteractionOptionIndex] = useState(0)
  const interactionOptions = interactionRequest?.payload.options ?? []
  const buildUserMessage = (content: string | ChatMessageContent[]): ChatMessage => {
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
    return {
      id,
      role: 'user' as const,
      content,
      createdAt: Date.now()
    }
  }
  const validateSessionTarget = () => {
    if (session?.id != null || isChatSessionTargetReady(sessionTargetDraft)) {
      return true
    }

    void message.warning(t('chat.sessionTarget.missingResourceWarning'))
    return false
  }

  const handleSendContent = async (content: ChatMessageContent[], mode?: SessionQueuedMessageMode) => {
    if (!validateSessionTarget()) {
      return false
    }

    const resolvedMode = mode ?? queueMode

    if (session?.id && session.status === 'running') {
      const didQueue = await enqueueContent(resolvedMode, content)
      if (didQueue && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didQueue
    }

    if (!session?.id) {
      const optimisticMessage = buildUserMessage(content)
      setMessages((prev) => [...prev, optimisticMessage])
      const didSend = await sendContent(content, mode)
      if (!didSend) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      }
      if (didSend && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didSend
    }

    const didSend = await sendContent(content, mode)
    if (didSend) {
      setMessages((prev) => [...prev, buildUserMessage(content)])
      if (queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
    }
    return didSend
  }

  const handleSend = async (text: string, mode?: SessionQueuedMessageMode) => {
    if (!validateSessionTarget()) {
      return false
    }

    const resolvedMode = mode ?? queueMode

    if (session?.id && session.status === 'running') {
      const didQueue = await enqueueContent(resolvedMode, [{ type: 'text', text: text.trim() }])
      if (didQueue && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didQueue
    }

    if (!session?.id) {
      const optimisticMessage = buildUserMessage(text)
      setMessages((prev) => [...prev, optimisticMessage])
      const didSend = await send(text, mode)
      if (!didSend) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      }
      if (didSend && queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
      return didSend
    }

    const didSend = await send(text, mode)
    if (didSend) {
      setMessages((prev) => [...prev, buildUserMessage(text)])
      if (queuedDraft != null) {
        setQueuedDraft(null)
        setQueueMode('steer')
      }
    }
    return didSend
  }
  useEffect(() => {
    initialScrollDoneRef.current = false
    handledHashAnchorIdRef.current = ''
    handledTargetScrollKeyRef.current = ''
    setEditingMessageId(null)
    setExpandedTurnIds(new Set())
    setQueuedDraft(null)
    setQueueMode('steer')
    setSessionTargetDraft(
      session?.id != null
        ? getChatSessionTargetDraftFromSession(session)
        : { ...DEFAULT_CHAT_SESSION_TARGET_DRAFT }
    )
  }, [session?.id, session?.promptName, session?.promptType])
  useEffect(() => {
    if (session?.id != null) {
      return
    }

    workspaceDraftDirtyRef.current = false
    setWorkspaceDraft({
      ...configWorkspaceDraft
    })
  }, [session?.id])
  useEffect(() => {
    if (session?.id != null) {
      return
    }

    if (workspaceDraftDirtyRef.current) {
      return
    }

    setWorkspaceDraft({
      ...configWorkspaceDraft
    })
  }, [configWorkspaceDraft, session?.id])
  useEffect(() => {
    setActiveInteractionOptionIndex(0)
  }, [interactionRequest?.id])
  useEffect(() => {
    if (interactionOptions.length === 0) {
      setActiveInteractionOptionIndex(0)
      return
    }

    setActiveInteractionOptionIndex((current) => Math.min(current, interactionOptions.length - 1))
  }, [interactionOptions.length])

  const handleMoveInteractionOption = useCallback((delta: number) => {
    if (interactionOptions.length === 0) {
      return
    }

    setActiveInteractionOptionIndex((current) => getLoopedIndex(current, delta, interactionOptions.length))
  }, [interactionOptions.length])

  const handleSubmitActiveInteractionOption = useCallback(() => {
    if (interactionRequest == null) {
      return
    }

    const option = interactionOptions[activeInteractionOptionIndex] ?? interactionOptions[0]
    if (option == null) {
      return
    }

    onInteractionResponse(interactionRequest.id, option.value ?? option.label)
  }, [activeInteractionOptionIndex, interactionOptions, interactionRequest, onInteractionResponse])

  useEffect(() => {
    if (!initialScrollDoneRef.current && isReady && location.hash === '') {
      scrollToBottom('auto')
      initialScrollDoneRef.current = true
    }
  }, [historyRenderCount, isReady, location.hash, scrollToBottom])
  useEffect(() => {
    if (location.hash === '' && !showScrollBottom) {
      scrollToBottom('auto')
    }
  }, [historyRenderCount, location.hash, scrollToBottom, showScrollBottom])
  const handleStartEditing = (messageId: string) => {
    let isBlocked = false

    setEditingMessageId((current) => {
      if (current != null && current !== messageId) {
        isBlocked = true
        return current
      }

      return messageId
    })

    if (isBlocked) {
      void message.warning(t('chat.messageActions.editInProgress'))
    }
  }
  const isInlineEditing = editingMessageId != null
  const shouldShowNewSessionGuide = !session?.id && messages.length === 0 && historyStatusNotices.length === 0
  const renderItems = useMemo(() => processMessages(messages), [messages])
  const hashAnchorId = useMemo(() => decodeURIComponent(location.hash.replace(/^#/, '')), [location.hash])
  const targetAnchorId = useMemo(() => {
    if (targetToolUseId != null && targetToolUseId !== '') {
      const targetToolGroup = renderItems.find((item) => {
        return item.type === 'tool-group' && item.items.some(toolItem => toolItem.item.id === targetToolUseId)
      })
      return targetToolGroup?.anchorId ?? ''
    }

    if (targetMessageId != null && targetMessageId !== '') {
      const targetMessage = renderItems.find((item) => {
        return item.type === 'message' && item.originalMessage.id === targetMessageId
      })
      return targetMessage?.anchorId ?? ''
    }

    return ''
  }, [renderItems, targetMessageId, targetToolUseId])
  const messageTurns = useMemo(() =>
    buildMessageTurns({
      renderItems,
      expandedTurnIds,
      hashAnchorId: hashAnchorId !== '' ? hashAnchorId : targetAnchorId,
      keepLastTurnExpanded: isCreating || session?.status === 'running' || session?.status === 'waiting_input'
    }), [expandedTurnIds, hashAnchorId, isCreating, renderItems, session?.status, targetAnchorId])
  const lastAssistantActionAnchorId = useMemo(() => {
    for (let index = renderItems.length - 1; index >= 0; index -= 1) {
      const item = renderItems[index]
      if (item == null) continue
      if (item.type === 'tool-group') continue
      if (item.message.role === 'user') continue
      return item.anchorId
    }
    return null
  }, [renderItems])
  const handleEditQueuedMessage = async (item: SessionQueuedMessage) => {
    const removed = await removeQueuedContent(item.id)
    if (!removed) {
      return
    }
    setQueuedDraft({ content: item.content })
    setQueueMode('steer')
  }
  const handleMoveQueuedMessage = async (item: SessionQueuedMessage, targetMode: SessionQueuedMessageMode) => {
    await moveQueuedContent(item.id, targetMode)
  }
  const isPermissionInteraction = interactionRequest?.payload.kind === 'permission'
  const interactionPanel = !isInlineEditing && interactionRequest != null
    ? (
      <SenderInteractionPanel
        interactionRequest={interactionRequest}
        activeOptionIndex={activeInteractionOptionIndex}
        permissionContext={interactionRequest.payload.kind === 'permission'
          ? interactionRequest.payload.permissionContext
          : undefined}
        deniedTools={interactionRequest.payload.kind === 'permission'
          ? (interactionRequest.payload.permissionContext?.deniedTools ?? [])
          : []}
        reasons={interactionRequest.payload.kind === 'permission'
          ? (interactionRequest.payload.permissionContext?.reasons ?? [])
          : []}
        onActiveOptionIndexChange={setActiveInteractionOptionIndex}
        onMoveActiveOption={handleMoveInteractionOption}
        onInteractionResponse={onInteractionResponse}
      />
    )
    : null

  useEffect(() => {
    const hash = hashAnchorId
    if (hash === '') {
      handledHashAnchorIdRef.current = ''
      return
    }

    if (!isReady || handledHashAnchorIdRef.current === hash) return

    let removeHighlightTimer: ReturnType<typeof setTimeout> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let frameId: number | null = null

    const scrollToAnchor = () => {
      const target = document.getElementById(hash)
      if (target == null) {
        return false
      }

      handledHashAnchorIdRef.current = hash
      target.scrollIntoView({ block: 'center', behavior: 'auto' })
      target.classList.add('is-anchor-target')
      removeHighlightTimer = setTimeout(() => {
        target.classList.remove('is-anchor-target')
      }, 1800)
      return true
    }

    if (!scrollToAnchor()) {
      frameId = requestAnimationFrame(() => {
        if (!scrollToAnchor()) {
          retryTimer = setTimeout(() => {
            void scrollToAnchor()
          }, 120)
        }
      })
    }

    return () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId)
      }
      if (retryTimer != null) {
        clearTimeout(retryTimer)
      }
      if (removeHighlightTimer != null) {
        clearTimeout(removeHighlightTimer)
      }
    }
  }, [hashAnchorId, isReady, messageTurns])

  useEffect(() => {
    const targetAttr = targetToolUseId != null && targetToolUseId !== ''
      ? { key: 'data-tool-use-id', value: targetToolUseId, targetKey: `tool:${targetToolUseId}` }
      : targetMessageId != null && targetMessageId !== ''
      ? { key: 'data-message-id', value: targetMessageId, targetKey: `message:${targetMessageId}` }
      : undefined
    if (targetAttr == null) {
      handledTargetScrollKeyRef.current = ''
      return
    }

    if (handledTargetScrollKeyRef.current === targetAttr.targetKey) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const container = messagesContentRef.current
      if (container == null) {
        return
      }

      const target = Array.from(container.querySelectorAll<HTMLElement>(`[${targetAttr.key}]`))
        .find(element => element.getAttribute(targetAttr.key) === targetAttr.value)
      if (target == null) {
        return
      }

      handledTargetScrollKeyRef.current = targetAttr.targetKey
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [messageTurns, messagesContentRef, targetMessageId, targetToolUseId])

  const toggleTurnCollapsed = (turnId: string) => {
    setExpandedTurnIds((prev) => {
      const next = new Set(prev)
      if (next.has(turnId)) {
        next.delete(turnId)
      } else {
        next.add(turnId)
      }
      return next
    })
  }

  const formatTurnDuration = (durationMs: number | null) => {
    if (durationMs == null) return null
    const totalSeconds = Math.floor(durationMs / 1000)
    if (totalSeconds <= 0) {
      return t('chat.turnDurationUnderSecond')
    }

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return [
        t('chat.turnDurationHours', { count: hours }),
        minutes > 0 ? t('chat.turnDurationMinutes', { count: minutes }) : null
      ].filter(Boolean).join(' ')
    }

    if (minutes > 0) {
      return [
        t('chat.turnDurationMinutes', { count: minutes }),
        seconds > 0 ? t('chat.turnDurationSeconds', { count: seconds }) : null
      ].filter(Boolean).join(' ')
    }

    return t('chat.turnDurationSeconds', { count: seconds })
  }

  const renderTurnSummary = (turn: (typeof messageTurns)[number]) => (
    <div className={`chat-turn-summary ${turn.isCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
      <div className='chat-turn-summary__content'>
        <div className='chat-turn-summary__meta'>
          {formatTurnDuration(turn.durationMs) != null && (
            <span className='chat-turn-summary__time'>
              {t('chat.turnProcessedDuration', { duration: formatTurnDuration(turn.durationMs) })}
            </span>
          )}
          <span className='chat-turn-summary__count'>
            {t('chat.turnSummaryCount', { count: turn.hiddenCount })}
          </span>
        </div>
        <button
          type='button'
          className='chat-turn-summary__toggle'
          aria-expanded={!turn.isCollapsed}
          onClick={() => toggleTurnCollapsed(turn.id)}
        >
          <span className='material-symbols-rounded'>
            chevron_right
          </span>
        </button>
      </div>
    </div>
  )

  const renderTurnItem = (item: (typeof renderItems)[number], key?: string) => {
    if (item.type === 'message') {
      return (
        <MessageItem
          key={key ?? item.anchorId}
          anchorId={item.anchorId}
          msg={item.message}
          isFirstInGroup={item.isFirstInGroup}
          isTargeted={item.originalMessage.id === targetMessageId}
          originalMessage={item.originalMessage}
          sessionInfo={sessionInfo}
          isEditing={editingMessageId === item.originalMessage.id}
          isCompactLayout={isCompactLayout}
          isTouchInteraction={isTouchInteraction}
          isSessionBusy={isCreating || session?.status === 'running' ||
            session?.status === 'waiting_input'}
          showAssistantActions={item.anchorId === lastAssistantActionAnchorId}
          onEditMessage={editMessage}
          onForkMessage={forkMessage}
          onRecallMessage={recallMessage}
          onStartEditing={handleStartEditing}
          onCancelEditing={(messageId) => {
            setEditingMessageId((current) => current === messageId ? null : current)
          }}
          sessionId={session?.id}
        />
      )
    }

    return (
      <ToolGroup
        key={key ?? item.id}
        anchorId={item.anchorId}
        items={item.items}
        originalMessage={item.originalMessage}
        sessionId={session?.id}
        targetToolUseId={targetToolUseId}
        footer={item.footer}
      />
    )
  }

  const composerContent = (
    <>
      {isPermissionInteraction && interactionPanel}
      <CurrentTodoList messages={messages} />
      {!isInlineEditing && (
        <QueuedMessagesCard
          mode='next'
          items={queuedMessages.next}
          onMove={(item, targetMode) => void handleMoveQueuedMessage(item, targetMode)}
          onDelete={(item) => void removeQueuedContent(item.id)}
          onEdit={(item) => void handleEditQueuedMessage(item)}
          onReorder={(ids) => reorderQueuedContent('next', ids)}
        />
      )}
      {!isInlineEditing && (
        <QueuedMessagesCard
          mode='steer'
          items={queuedMessages.steer}
          onMove={(item, targetMode) => void handleMoveQueuedMessage(item, targetMode)}
          onDelete={(item) => void removeQueuedContent(item.id)}
          onEdit={(item) => void handleEditQueuedMessage(item)}
          onReorder={(ids) => reorderQueuedContent('steer', ids)}
        />
      )}
      {!isPermissionInteraction && interactionPanel}
      {!isInlineEditing && (
        <div className='sender-container'>
          <Sender
            onSend={handleSend}
            onSendContent={handleSendContent}
            adapterLocked={session?.id != null}
            sessionId={session?.id}
            sessionStatus={isCreating ? 'running' : session?.status}
            onInterrupt={interrupt}
            onClear={clearMessages}
            sessionInfo={sessionInfo}
            interactionRequest={interactionRequest}
            onInteractionResponse={onInteractionResponse}
            interactionOptionNavigation={interactionRequest != null && interactionOptions.length > 0
              ? {
                optionCount: interactionOptions.length,
                activeIndex: activeInteractionOptionIndex,
                onMove: handleMoveInteractionOption,
                onSubmit: handleSubmitActiveInteractionOption
              }
              : undefined}
            initialContent={queuedDraft?.content}
            placeholder={placeholder}
            submitLabel={queuedDraft != null ? t('chat.queue.requeueMessage') : undefined}
            modelMenuGroups={modelMenuGroups}
            modelSearchOptions={modelSearchOptions}
            recommendedModelOptions={recommendedModelOptions}
            servicePreviewModelOptions={servicePreviewModelOptions}
            onToggleRecommendedModel={onToggleRecommendedModel}
            updatingRecommendedModelValue={updatingRecommendedModelValue}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            effort={effort}
            effortOptions={effortOptions}
            onEffortChange={onEffortChange}
            permissionMode={permissionMode}
            permissionModeOptions={permissionModeOptions}
            onPermissionModeChange={onPermissionModeChange}
            selectedAdapter={selectedAdapter}
            adapterOptions={adapterOptions}
            onAdapterChange={onAdapterChange}
            selectedAccount={selectedAccount}
            accountOptions={accountOptions}
            showAccountSelector={showAccountSelector}
            onAccountChange={onAccountChange}
            modelUnavailable={modelUnavailable}
            sessionTarget={{
              draft: session?.id != null ? getChatSessionTargetDraftFromSession(session) : sessionTargetDraft,
              locked: session?.id != null,
              disabled: isCreating,
              onChange: setSessionTargetDraft
            }}
            queueMode={queueMode}
            onQueueModeChange={setQueueMode}
            contextReferenceRequest={contextReferenceRequest}
          />
          <ChatStatusBar
            draftWorkspace={workspaceDraft}
            isCreating={isCreating}
            sessionId={session?.id}
            adapterLocked={session?.id != null}
            isThinking={isCreating || session?.status === 'running'}
            modelUnavailable={modelUnavailable}
            selectedAdapter={selectedAdapter}
            adapterOptions={adapterOptions}
            onAdapterChange={onAdapterChange}
            selectedAccount={selectedAccount}
            accountOptions={accountOptions}
            showAccountSelector={showAccountSelector}
            onAccountChange={onAccountChange}
            onDraftWorkspaceChange={(nextDraft) => {
              workspaceDraftDirtyRef.current = true
              setWorkspaceDraft(nextDraft)
            }}
          />
        </div>
      )}
    </>
  )

  return (
    <>
      <div className={`chat-messages ${isReady ? 'ready' : ''}`} ref={messagesContainerRef}>
        <div className='chat-messages-content' ref={messagesContentRef}>
          {!session?.id && isCreating && (
            <div className='chat-pending-session-banner'>
              <span className='material-symbols-rounded'>hourglass_top</span>
              <span>{t('common.creatingChat')}</span>
            </div>
          )}
          {messageTurns.map((turn) => (
            turn.isExpandable
              ? (
                <div key={turn.id} className={`chat-turn ${turn.isCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
                  {renderTurnItem(turn.items[0]!, `${turn.id}:leading`)}
                  <div className={`chat-turn__summary-region ${turn.isCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
                    {renderTurnSummary(turn)}
                    <div
                      className={`chat-turn__collapsible ${turn.isCollapsed ? 'is-collapsed' : 'is-expanded'}`}
                      aria-hidden={turn.isCollapsed}
                    >
                      <div className='chat-turn__collapsible-inner'>
                        {turn.items.slice(1, -1).map((item) => renderTurnItem(item))}
                      </div>
                    </div>
                  </div>
                  {renderTurnItem(turn.items[turn.items.length - 1]!, `${turn.id}:trailing`)}
                </div>
              )
              : (
                <React.Fragment key={turn.id}>
                  {turn.items.map((item) => renderTurnItem(item))}
                </React.Fragment>
              )
          ))}
          {historyStatusNotices.map(notice => (
            <MessageStatusNotice
              key={notice.id}
              notice={notice}
              onRetryConnection={onRetryConnection}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {showScrollBottom && (
          <div className='scroll-bottom-btn' onClick={() => scrollToBottom()}>
            <span className='material-symbols-rounded'>arrow_downward</span>
          </div>
        )}
      </div>

      {shouldShowNewSessionGuide
        ? (
          <ComposerLanding compact={isCompactLayout} composer={composerContent}>
            <NewSessionGuide
              selectedTarget={sessionTargetDraft}
              onSelectTarget={setSessionTargetDraft}
            />
          </ComposerLanding>
        )
        : (
          <ComposerStack>
            {composerContent}
          </ComposerStack>
        )}
    </>
  )
}
