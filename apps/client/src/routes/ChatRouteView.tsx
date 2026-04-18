import { useSetAtom } from 'jotai'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import type { Session } from '@vibe-forge/core'

import { ChatHeader } from '#~/components/chat/ChatHeader.js'
import { ChatHistoryView } from '#~/components/chat/ChatHistoryView.js'
import { ChatSettingsView } from '#~/components/chat/ChatSettingsView.js'
import { ChatTimelineView } from '#~/components/chat/ChatTimelineView.js'
import { buildChatHistoryStatusNotices } from '#~/components/chat/messages/build-chat-history-status-notices'
import { ChatWorkspaceDrawer } from '#~/components/chat/workspace-drawer/ChatWorkspaceDrawer'
import { useChatRouteBottomPanel } from '#~/hooks/chat/use-chat-route-bottom-panel'
import { useChatRouteDeepLinkView } from '#~/hooks/chat/use-chat-route-deep-link-view'
import { useChatSession } from '#~/hooks/chat/use-chat-session'
import { useTerminalDockVisibility } from '#~/hooks/chat/use-terminal-dock-visibility'
import { useChatLayoutQueryState } from '#~/hooks/use-chat-layout-query-state'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { isMobileSidebarOpenAtom } from '#~/store/index'

import { ChatRouteBottomPanel } from './ChatRouteBottomPanel'

const WORKSPACE_TERMINAL_SESSION_ID = '__workspace__'

export function ChatRouteView({ session }: { session?: Session }) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isCompactLayout } = useResponsiveLayout()
  const { isWorkspaceDrawerOpen, setWorkspaceDrawerOpen } = useChatLayoutQueryState()
  const setIsMobileSidebarOpen = useSetAtom(isMobileSidebarOpenAtom)
  const {
    messages,
    sessionInfo,
    queuedMessages,
    interactionRequest,
    isReady,
    errorState,
    retryConnection,
    activeView,
    isTerminalOpen,
    setActiveView,
    setIsTerminalOpen,
    handleInteractionResponse,
    setMessages,
    placeholder,
    modelMenuGroups,
    modelSearchOptions,
    recommendedModelOptions,
    servicePreviewModelOptions,
    toggleRecommendedModel,
    updatingRecommendedModelValue,
    selectedModel,
    modelForQuery,
    setSelectedModel,
    effort,
    setEffort,
    effortOptions,
    permissionMode,
    setPermissionMode,
    permissionModeOptions,
    selectedAdapter,
    setSelectedAdapter,
    adapterOptions,
    hasAvailableModels,
    modelUnavailable
  } = useChatSession({ session })
  const targetMessageId = searchParams.get('messageId') ?? undefined
  const targetToolUseId = searchParams.get('toolUseId') ?? undefined
  const isDebugMode = searchParams.get('debug') === 'true'
  const historyStatusNotices = useMemo(() =>
    buildChatHistoryStatusNotices({
      errorState,
      isDebugMode,
      modelUnavailable,
      t
    }), [errorState, isDebugMode, modelUnavailable, t])
  const isEmptyNewSession = !session?.id && messages.length === 0 && historyStatusNotices.length === 0
  const resolvedActiveView = session?.id != null ? activeView : 'history'
  const terminalSessionId = session?.id ?? WORKSPACE_TERMINAL_SESSION_ID
  const {
    handleCloseTerminal,
    handleCloseWorkspaceFile,
    handleCloseWorkspaceFileTab,
    handleOpenWorkspaceFile,
    handleSelectWorkspaceFile,
    handleToggleTerminal,
    openWorkspaceFilePaths,
    selectedWorkspaceFilePath,
    shouldShowBottomPanel,
    shouldShowFileEditor,
    shouldShowTerminal
  } = useChatRouteBottomPanel({ isTerminalOpen, setIsTerminalOpen })
  const shouldShowWorkspaceDrawer = isWorkspaceDrawerOpen && !isCompactLayout
  const { isRendered: isBottomPanelRendered, isVisible: isBottomPanelVisible } = useTerminalDockVisibility(
    shouldShowBottomPanel
  )
  useChatRouteDeepLinkView({ activeView, setActiveView, targetMessageId, targetToolUseId })
  return (
    <div
      className={`chat-route-layout ${shouldShowWorkspaceDrawer ? 'has-workspace-drawer' : ''} ${
        shouldShowTerminal ? 'has-terminal' : ''
      } ${shouldShowBottomPanel ? 'has-bottom-dock' : ''}`}
    >
      <div className='chat-route-layout__main'>
        <div
          className={`chat-container ${isReady ? 'ready' : ''} ${isEmptyNewSession ? 'is-new-session' : ''}`}
        >
          <ChatHeader
            sessionInfo={sessionInfo}
            sessionId={session?.id}
            sessionTitle={session?.title}
            sessionStatus={session?.status}
            isStarred={session?.isStarred}
            isArchived={session?.isArchived}
            tags={session?.tags}
            lastMessage={session?.lastMessage}
            lastUserMessage={session?.lastUserMessage}
            activeView={resolvedActiveView}
            isTerminalOpen={shouldShowTerminal}
            isWorkspaceDrawerOpen={shouldShowWorkspaceDrawer}
            onCreateSession={() => void navigate('/')}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            onViewChange={setActiveView}
            onToggleTerminal={handleToggleTerminal}
            onToggleWorkspaceDrawer={() => setWorkspaceDrawerOpen(!isWorkspaceDrawerOpen)}
          />
          {resolvedActiveView === 'history' && (
            <ChatHistoryView
              isReady={isReady}
              messages={messages}
              session={session}
              targetMessageId={targetMessageId}
              targetToolUseId={targetToolUseId}
              sessionInfo={sessionInfo}
              historyStatusNotices={historyStatusNotices}
              queuedMessages={queuedMessages}
              onRetryConnection={retryConnection}
              interactionRequest={interactionRequest}
              onInteractionResponse={handleInteractionResponse}
              setMessages={setMessages}
              onClearMessages={() => setMessages([])}
              placeholder={placeholder}
              modelMenuGroups={modelMenuGroups}
              modelSearchOptions={modelSearchOptions}
              recommendedModelOptions={recommendedModelOptions}
              servicePreviewModelOptions={servicePreviewModelOptions}
              onToggleRecommendedModel={toggleRecommendedModel}
              updatingRecommendedModelValue={updatingRecommendedModelValue}
              selectedModel={selectedModel}
              modelForQuery={modelForQuery}
              onModelChange={setSelectedModel}
              effort={effort}
              effortOptions={effortOptions}
              onEffortChange={setEffort}
              permissionMode={permissionMode}
              permissionModeOptions={permissionModeOptions}
              onPermissionModeChange={setPermissionMode}
              selectedAdapter={selectedAdapter}
              adapterOptions={adapterOptions}
              onAdapterChange={setSelectedAdapter}
              modelUnavailable={modelUnavailable}
              hasAvailableModels={hasAvailableModels}
            />
          )}

          {resolvedActiveView === 'timeline' && <ChatTimelineView messages={messages} />}
          {resolvedActiveView === 'settings' && session?.id &&
            <ChatSettingsView session={session} sessionInfo={sessionInfo} onClose={() => setActiveView('history')} />}
        </div>
        {shouldShowWorkspaceDrawer && (
          <ChatWorkspaceDrawer
            selectedFilePath={selectedWorkspaceFilePath}
            sessionId={session?.id}
            onOpenFile={handleOpenWorkspaceFile}
          />
        )}
      </div>
      <ChatRouteBottomPanel
        isRendered={isBottomPanelRendered}
        isVisible={isBottomPanelVisible}
        openWorkspaceFilePaths={openWorkspaceFilePaths}
        selectedWorkspaceFilePath={selectedWorkspaceFilePath}
        sessionId={session?.id}
        shouldShowFileEditor={shouldShowFileEditor}
        shouldShowTerminal={shouldShowTerminal}
        terminalSessionId={terminalSessionId}
        onCloseFileEditor={handleCloseWorkspaceFile}
        onCloseWorkspaceFileTab={handleCloseWorkspaceFileTab}
        onCloseTerminal={handleCloseTerminal}
        onSelectWorkspaceFile={handleSelectWorkspaceFile}
      />
    </div>
  )
}
