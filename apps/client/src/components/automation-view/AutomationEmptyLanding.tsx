import './AutomationEmptyLanding.scss'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { ChatMessageContent } from '@vibe-forge/core'
import type { ConfigResponse } from '@vibe-forge/types'

import { getConfig } from '#~/api.js'
import { Sender } from '#~/components/chat/sender/Sender'
import { ChatStatusBar } from '#~/components/chat/status-bar/ChatStatusBar'
import { ComposerLanding } from '#~/components/composer-landing/ComposerLanding'
import {
  DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT,
  getChatSessionWorkspaceDraftFromConfig
} from '#~/hooks/chat/chat-session-workspace-draft'
import { useChatEffort } from '#~/hooks/chat/use-chat-effort'
import { useChatModelAdapterSelection } from '#~/hooks/chat/use-chat-model-adapter-selection'
import { useChatPermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useChatSessionActions } from '#~/hooks/chat/use-chat-session-actions'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { AutomationEmptyGuide } from './AutomationEmptyGuide'

const noop = () => {}

export function AutomationEmptyLanding() {
  const { t } = useTranslation()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)
  const workspaceDraftDirtyRef = useRef(false)
  const defaultWorkspaceDraft = useMemo(() => (
    configRes == null ? DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT : getChatSessionWorkspaceDraftFromConfig(configRes)
  ), [configRes])
  const [workspaceDraft, setWorkspaceDraft] = useState(() => ({
    ...DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT
  }))
  const [starterContent, setStarterContent] = useState('')
  const [starterContentKey, setStarterContentKey] = useState(0)
  const {
    adapterOptions,
    hasAvailableModels,
    modelMenuGroups,
    modelSearchOptions,
    recommendedModelOptions,
    selectedAdapter,
    selectedModel,
    selectedModelWithService,
    servicePreviewModelOptions,
    setSelectedAdapter,
    setSelectedModel,
    toggleRecommendedModel,
    updatingRecommendedModelValue
  } = useChatModelAdapterSelection()
  const { effort, setEffort, effortOptions } = useChatEffort()
  const { permissionMode, setPermissionMode, permissionModeOptions } = useChatPermissionMode()
  const {
    isCreating,
    send,
    sendContent,
    interrupt
  } = useChatSessionActions({
    modelForQuery: selectedModelWithService,
    hasAvailableModels,
    effort,
    permissionMode,
    adapter: selectedAdapter,
    workspaceDraft,
    onClearMessages: noop
  })

  const handleSelectStarter = (prompt: string) => {
    setStarterContent(prompt)
    setStarterContentKey((current) => current + 1)
  }

  const buildAutomationCreationText = (text: string) => {
    const request = text.trim()
    const lowerRequest = request.toLowerCase()
    if (request.includes('自动化任务工具') || lowerRequest.includes('automation tools')) {
      return request
    }
    return t('automation.emptyLandingSendInstruction', { request })
  }

  const buildAutomationCreationContent = (content: ChatMessageContent[]) => {
    let didWrapText = false
    const nextContent = content.map((item): ChatMessageContent => {
      if (item.type !== 'text' || didWrapText) {
        return item
      }

      didWrapText = true
      return {
        ...item,
        text: buildAutomationCreationText(item.text)
      }
    })

    if (didWrapText) {
      return nextContent
    }

    return [
      { type: 'text' as const, text: t('automation.emptyLandingAttachmentInstruction') },
      ...nextContent
    ]
  }

  const composer = (
    <div className='sender-container automation-empty-guide__composer'>
      <Sender
        key={starterContentKey}
        initialContent={starterContent}
        placeholder={t('automation.emptyLandingPlaceholder')}
        autoFocus
        sessionStatus={isCreating ? 'running' : undefined}
        onInterrupt={interrupt}
        onSend={(text) => send(buildAutomationCreationText(text))}
        onSendContent={(content: ChatMessageContent[]) => sendContent(buildAutomationCreationContent(content))}
        modelMenuGroups={modelMenuGroups}
        modelSearchOptions={modelSearchOptions}
        recommendedModelOptions={recommendedModelOptions}
        servicePreviewModelOptions={servicePreviewModelOptions}
        onToggleRecommendedModel={toggleRecommendedModel}
        updatingRecommendedModelValue={updatingRecommendedModelValue}
        selectedModel={selectedModel}
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
        modelUnavailable={!hasAvailableModels}
      />
      <ChatStatusBar
        draftWorkspace={workspaceDraft}
        isCreating={isCreating}
        onDraftWorkspaceChange={(nextDraft) => {
          workspaceDraftDirtyRef.current = true
          setWorkspaceDraft(nextDraft)
        }}
      />
    </div>
  )

  useEffect(() => {
    if (workspaceDraftDirtyRef.current) {
      return
    }
    setWorkspaceDraft({ ...defaultWorkspaceDraft })
  }, [defaultWorkspaceDraft])

  return (
    <ComposerLanding
      className='automation-empty-landing'
      compact={isCompactLayout || isTouchInteraction}
      composer={composer}
    >
      <AutomationEmptyGuide onSelectStarter={handleSelectStarter} />
    </ComposerLanding>
  )
}
