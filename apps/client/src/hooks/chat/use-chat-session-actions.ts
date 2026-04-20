import { App } from 'antd'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSWRConfig } from 'swr'

import type { ChatMessageContent, Session, SessionQueuedMessageMode } from '@vibe-forge/core'

import {
  branchSessionFromMessage,
  createQueuedMessage,
  createSession,
  deleteQueuedMessage,
  deleteSession,
  getApiErrorMessage,
  getSessionMessages,
  moveQueuedMessage,
  reorderQueuedMessages,
  updateQueuedMessage
} from '#~/api.js'
import { connectionManager } from '#~/connectionManager.js'
import { useSenderHeaderQueryState } from '#~/hooks/use-sender-header-query-state.js'

import { getChatSessionTargetPrompt } from './chat-session-target'
import type { ChatSessionTargetDraft } from './chat-session-target'
import type { ChatSessionWorkspaceDraft } from './chat-session-workspace-draft'
import {
  clearOptimisticSessionDiscarded,
  createOptimisticSessionCreation,
  createOptimisticSessionId,
  isOptimisticSessionDiscarded,
  markOptimisticSessionCreationCreating,
  markOptimisticSessionCreationFailed,
  optimisticSessionCreationsAtom,
  removeSessionFromList
} from './optimistic-session-creation'
import type {
  OptimisticSessionCreation,
  OptimisticSessionCreationOptions,
  OptimisticSessionCreationRequest
} from './optimistic-session-creation'
import { useBrowserSessionEntryContext } from './use-browser-session-entry-context'
import type { ChatEffort } from './use-chat-effort'
import type { PermissionMode } from './use-chat-permission-mode'

export function useChatSessionActions({
  session,
  modelForQuery,
  hasAvailableModels,
  effort,
  permissionMode,
  adapter,
  account,
  sessionTargetDraft,
  workspaceDraft,
  onClearMessages
}: {
  session?: Session
  modelForQuery?: string
  hasAvailableModels: boolean
  effort: ChatEffort
  permissionMode: PermissionMode
  adapter?: string
  account?: string
  sessionTargetDraft?: ChatSessionTargetDraft
  workspaceDraft?: ChatSessionWorkspaceDraft
  onClearMessages: () => void
}) {
  const { message } = App.useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { mutate } = useSWRConfig()
  const { setHeaderCollapsed } = useSenderHeaderQueryState()
  const optimisticCreations = useAtomValue(optimisticSessionCreationsAtom)
  const setOptimisticCreations = useSetAtom(optimisticSessionCreationsAtom)
  const browserEntryContext = useBrowserSessionEntryContext()
  const [isCreating, setIsCreating] = useState(false)
  const isThinking = isCreating || session?.status === 'running'
  const optimisticCreation = session?.id == null || session.id === ''
    ? undefined
    : optimisticCreations[session.id]

  const navigateWithSearchPatch = useCallback((
    pathname: string,
    patch?: Record<string, string>
  ) => {
    const nextParams = new URLSearchParams(location.search)

    if (patch != null) {
      for (const [key, value] of Object.entries(patch)) {
        if (value === '') {
          nextParams.delete(key)
        } else {
          nextParams.set(key, value)
        }
      }
    }

    void navigate({
      pathname,
      search: nextParams.toString() === '' ? '' : `?${nextParams.toString()}`
    })
  }, [location.search, navigate])

  const navigateWithCurrentSearch = useCallback((pathname: string) => {
    navigateWithSearchPatch(pathname)
  }, [navigateWithSearchPatch])

  const insertSessionIntoCache = useCallback(async (newSession: Session) => {
    await mutate('/api/sessions', (prev: { sessions: Session[] } | undefined) => {
      if (!prev?.sessions) {
        return { sessions: [newSession] }
      }

      const withoutCurrent = prev.sessions.filter((item) => item.id !== newSession.id)
      return {
        ...prev,
        sessions: [newSession, ...withoutCurrent]
      }
    }, false)
  }, [mutate])

  const removeSessionFromCache = useCallback(async (id: string) => {
    await mutate('/api/sessions', (prev: { sessions: Session[] } | undefined) => {
      if (prev?.sessions == null) return prev
      return {
        ...prev,
        sessions: removeSessionFromList(prev.sessions, id)
      }
    }, false)
    await mutate('/api/sessions/archived', (prev: { sessions: Session[] } | undefined) => {
      if (prev?.sessions == null) return prev
      return {
        ...prev,
        sessions: removeSessionFromList(prev.sessions, id)
      }
    }, false)
  }, [mutate])

  const removeOptimisticCreation = useCallback((id: string) => {
    setOptimisticCreations((prev) => {
      if (prev[id] == null) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [setOptimisticCreations])

  const updateOptimisticCreation = useCallback((
    id: string,
    updater: (creation: OptimisticSessionCreation) => OptimisticSessionCreation
  ) => {
    setOptimisticCreations((prev) => {
      const current = prev[id]
      if (current == null) return prev
      return {
        ...prev,
        [id]: updater(current)
      }
    })
  }, [setOptimisticCreations])

  const resolveCreatedSession = useCallback(async (id: string) => {
    try {
      const res = await getSessionMessages(id)
      return res.session
    } catch (err) {
      console.warn('Failed to verify optimistic session creation state:', err)
      return undefined
    }
  }, [])

  const handleResolvedSessionCreation = useCallback(async (newSession: Session) => {
    if (isOptimisticSessionDiscarded(newSession.id)) {
      removeOptimisticCreation(newSession.id)
      await removeSessionFromCache(newSession.id)
      try {
        await deleteSession(newSession.id, { force: true })
      } catch (err) {
        console.warn('Failed to delete discarded optimistic session:', err)
      } finally {
        clearOptimisticSessionDiscarded(newSession.id)
      }
      return false
    }

    await insertSessionIntoCache(newSession)
    removeOptimisticCreation(newSession.id)
    clearOptimisticSessionDiscarded(newSession.id)
    setHeaderCollapsed(true)
    return true
  }, [
    insertSessionIntoCache,
    removeOptimisticCreation,
    removeSessionFromCache,
    setHeaderCollapsed
  ])

  const buildCreateSessionOptions = useCallback((id: string): OptimisticSessionCreationOptions => {
    const targetPrompt = getChatSessionTargetPrompt(sessionTargetDraft)
    return {
      id,
      ...targetPrompt,
      effort: effort === 'default' ? undefined : effort,
      permissionMode,
      adapter,
      account,
      entryContext: browserEntryContext,
      workspace: workspaceDraft == null
        ? undefined
        : {
          createWorktree: workspaceDraft.createWorktree,
          worktreeEnvironment: workspaceDraft.worktreeEnvironment,
          branch: workspaceDraft.branch
        }
    }
  }, [
    account,
    adapter,
    effort,
    browserEntryContext,
    permissionMode,
    sessionTargetDraft,
    workspaceDraft
  ])

  const runSessionCreationRequest = useCallback(async (
    request: OptimisticSessionCreationRequest
  ) => {
    try {
      const { session: newSession } = await createSession(
        request.title,
        request.initialMessage,
        request.initialContent,
        request.model,
        request.options
      )

      return await handleResolvedSessionCreation(newSession)
    } catch (err) {
      console.error(err)
      const recoveredSession = await resolveCreatedSession(request.id)
      if (recoveredSession != null) {
        return await handleResolvedSessionCreation(recoveredSession)
      }
      if (isOptimisticSessionDiscarded(request.id)) {
        removeOptimisticCreation(request.id)
        await removeSessionFromCache(request.id)
        clearOptimisticSessionDiscarded(request.id)
        return false
      }
      const errorMessage = getApiErrorMessage(err, t('chat.sessionCreateFailedMessage'))
      updateOptimisticCreation(request.id, creation => markOptimisticSessionCreationFailed(creation, errorMessage))
      return false
    }
  }, [
    handleResolvedSessionCreation,
    removeOptimisticCreation,
    removeSessionFromCache,
    resolveCreatedSession,
    t,
    updateOptimisticCreation
  ])

  const startOptimisticSessionCreation = useCallback((
    request: OptimisticSessionCreationRequest
  ) => {
    const creation = createOptimisticSessionCreation(request)
    clearOptimisticSessionDiscarded(creation.session.id)
    setIsCreating(true)
    setOptimisticCreations(prev => ({
      ...prev,
      [creation.session.id]: creation
    }))
    void insertSessionIntoCache(creation.session)
    navigateWithSearchPatch(`/session/${creation.session.id}`, {
      senderHeader: 'collapsed'
    })
    void runSessionCreationRequest(request)
  }, [insertSessionIntoCache, navigateWithSearchPatch, runSessionCreationRequest, setOptimisticCreations])

  const retrySessionCreation = useCallback(async () => {
    if (optimisticCreation == null) {
      return false
    }

    updateOptimisticCreation(optimisticCreation.session.id, markOptimisticSessionCreationCreating)
    void insertSessionIntoCache({
      ...optimisticCreation.session,
      status: 'running'
    })

    return await runSessionCreationRequest(optimisticCreation.request)
  }, [insertSessionIntoCache, optimisticCreation, runSessionCreationRequest, updateOptimisticCreation])

  useEffect(() => {
    if (!isCreating || session?.id == null || session.id === '') return
    setIsCreating(false)
  }, [isCreating, session?.id])

  const send = useCallback((text: string, _mode?: SessionQueuedMessageMode) => {
    if (text.trim() === '' || isThinking) return false
    if (!hasAvailableModels) {
      void message.warning(t('chat.modelConfigRequired'))
      return false
    }
    if (optimisticCreation != null) {
      void message.warning(t('chat.retrySessionCreationRequired'))
      return false
    }

    if (!session?.id) {
      const id = createOptimisticSessionId()
      startOptimisticSessionCreation({
        id,
        initialMessage: text.trim(),
        model: modelForQuery,
        options: buildCreateSessionOptions(id)
      })
      return true
    }

    connectionManager.send(session.id, {
      type: 'user_message',
      text: text.trim(),
      entryContext: browserEntryContext
    })
    return true
  }, [
    buildCreateSessionOptions,
    browserEntryContext,
    hasAvailableModels,
    isThinking,
    message,
    modelForQuery,
    optimisticCreation,
    session?.id,
    startOptimisticSessionCreation,
    t
  ])

  const sendContent = useCallback((content: ChatMessageContent[], _mode?: SessionQueuedMessageMode) => {
    if (content.length === 0 || isThinking) return false
    if (!hasAvailableModels) {
      void message.warning(t('chat.modelConfigRequired'))
      return false
    }
    if (optimisticCreation != null) {
      void message.warning(t('chat.retrySessionCreationRequired'))
      return false
    }

    if (!session?.id) {
      const id = createOptimisticSessionId()
      startOptimisticSessionCreation({
        id,
        initialContent: content,
        model: modelForQuery,
        options: buildCreateSessionOptions(id)
      })
      return true
    }

    connectionManager.send(session.id, {
      type: 'user_message',
      content,
      entryContext: browserEntryContext
    })
    return true
  }, [
    buildCreateSessionOptions,
    browserEntryContext,
    hasAvailableModels,
    isThinking,
    message,
    modelForQuery,
    optimisticCreation,
    session?.id,
    startOptimisticSessionCreation,
    t
  ])

  const interrupt = useCallback(() => {
    if (!session?.id || isThinking === false) return
    connectionManager.send(session.id, {
      type: 'interrupt'
    })
  }, [isThinking, session?.id])

  const clearMessages = useCallback(() => {
    onClearMessages()
    void message.success('Messages cleared')
  }, [message, onClearMessages])

  const runMessageAction = useCallback(async (
    messageId: string,
    action: 'fork' | 'recall' | 'edit',
    options?: { content?: string | ChatMessageContent[] }
  ) => {
    if (session?.id == null || session.id === '') {
      return false
    }

    try {
      const { session: newSession } = await branchSessionFromMessage(session.id, messageId, action, {
        ...options,
        entryContext: browserEntryContext
      })
      await insertSessionIntoCache(newSession)
      navigateWithCurrentSearch(`/session/${newSession.id}`)
      return true
    } catch (err) {
      console.error(err)
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      return false
    }
  }, [browserEntryContext, insertSessionIntoCache, message, navigateWithCurrentSearch, session?.id, t])

  const forkMessage = useCallback((messageId: string) => {
    return runMessageAction(messageId, 'fork')
  }, [runMessageAction])

  const recallMessage = useCallback((messageId: string) => {
    return runMessageAction(messageId, 'recall')
  }, [runMessageAction])

  const editMessage = useCallback((messageId: string, content: string | ChatMessageContent[]) => {
    return runMessageAction(messageId, 'edit', { content })
  }, [runMessageAction])

  const enqueueContent = useCallback(async (mode: SessionQueuedMessageMode, content: ChatMessageContent[]) => {
    if (session?.id == null || session.id === '') {
      return false
    }
    if (content.length === 0) {
      return false
    }

    try {
      await createQueuedMessage(session.id, mode, content)
      return true
    } catch (err) {
      console.error(err)
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      return false
    }
  }, [message, session?.id, t])

  const updateQueuedContent = useCallback(async (queueId: string, content: ChatMessageContent[]) => {
    if (session?.id == null || session.id === '') {
      return false
    }
    if (content.length === 0) {
      return false
    }

    try {
      await updateQueuedMessage(session.id, queueId, content)
      return true
    } catch (err) {
      console.error(err)
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      return false
    }
  }, [message, session?.id, t])

  const removeQueuedContent = useCallback(async (queueId: string) => {
    if (session?.id == null || session.id === '') {
      return false
    }

    try {
      await deleteQueuedMessage(session.id, queueId)
      return true
    } catch (err) {
      console.error(err)
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      return false
    }
  }, [message, session?.id, t])

  const moveQueuedContent = useCallback(async (queueId: string, mode: SessionQueuedMessageMode) => {
    if (session?.id == null || session.id === '') {
      return false
    }

    try {
      await moveQueuedMessage(session.id, queueId, mode)
      return true
    } catch (err) {
      console.error(err)
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      return false
    }
  }, [message, session?.id, t])

  const reorderQueuedContent = useCallback(async (mode: SessionQueuedMessageMode, ids: string[]) => {
    if (session?.id == null || session.id === '') {
      return false
    }

    try {
      await reorderQueuedMessages(session.id, mode, ids)
      return true
    } catch (err) {
      console.error(err)
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      return false
    }
  }, [message, session?.id, t])

  return {
    isCreating,
    isThinking,
    send,
    sendContent,
    retrySessionCreation,
    enqueueContent,
    updateQueuedContent,
    removeQueuedContent,
    moveQueuedContent,
    reorderQueuedContent,
    editMessage,
    forkMessage,
    interrupt,
    clearMessages,
    recallMessage
  }
}
