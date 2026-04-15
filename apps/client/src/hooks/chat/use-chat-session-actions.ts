import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSWRConfig } from 'swr'

import { branchSessionFromMessage, createSession, getApiErrorMessage } from '#~/api.js'
import { connectionManager } from '#~/connectionManager.js'
import type { ChatMessageContent, Session } from '@vibe-forge/core'

import type { ChatSessionWorkspaceDraft } from './chat-session-workspace-draft'
import type { ChatEffort } from './use-chat-effort'
import type { PermissionMode } from './use-chat-permission-mode'

export function useChatSessionActions({
  session,
  modelForQuery,
  hasAvailableModels,
  effort,
  permissionMode,
  adapter,
  workspaceDraft,
  onClearMessages
}: {
  session?: Session
  modelForQuery?: string
  hasAvailableModels: boolean
  effort: ChatEffort
  permissionMode: PermissionMode
  adapter?: string
  workspaceDraft?: ChatSessionWorkspaceDraft
  onClearMessages: () => void
}) {
  const { message } = App.useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { mutate } = useSWRConfig()
  const [isCreating, setIsCreating] = useState(false)
  const isThinking = isCreating || session?.status === 'running'

  const navigateWithCurrentSearch = useCallback((pathname: string) => {
    void navigate({
      pathname,
      search: location.search
    })
  }, [location.search, navigate])

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

  useEffect(() => {
    if (!isCreating || session?.id == null || session.id === '') return
    setIsCreating(false)
  }, [isCreating, session?.id])

  const send = useCallback(async (text: string) => {
    if (text.trim() === '' || isThinking) return false
    if (!hasAvailableModels) {
      void message.warning(t('chat.modelConfigRequired'))
      return false
    }

    if (!session?.id) {
      setIsCreating(true)
      try {
        const { session: newSession } = await createSession(undefined, text.trim(), undefined, modelForQuery, {
          effort: effort === 'default' ? undefined : effort,
          permissionMode,
          adapter,
          workspace: workspaceDraft == null
            ? undefined
            : {
                createWorktree: workspaceDraft.createWorktree,
                branch: workspaceDraft.branch
              }
        })

        await insertSessionIntoCache(newSession)

        navigateWithCurrentSearch(`/session/${newSession.id}`)
        return true
      } catch (err) {
        console.error(err)
        setIsCreating(false)
        void message.error(getApiErrorMessage(err, 'Failed to create session'))
        return false
      }
    }

    connectionManager.send(session.id, {
      type: 'user_message',
      text: text.trim()
    })
    return true
  }, [
    adapter,
    hasAvailableModels,
    isThinking,
    insertSessionIntoCache,
    message,
    navigateWithCurrentSearch,
    effort,
    permissionMode,
    workspaceDraft,
    modelForQuery,
    session?.id,
    t
  ])

  const sendContent = useCallback(async (content: ChatMessageContent[]) => {
    if (content.length === 0 || isThinking) return false
    if (!hasAvailableModels) {
      void message.warning(t('chat.modelConfigRequired'))
      return false
    }

    if (!session?.id) {
      setIsCreating(true)
      try {
        const { session: newSession } = await createSession(undefined, undefined, content, modelForQuery, {
          effort: effort === 'default' ? undefined : effort,
          permissionMode,
          adapter,
          workspace: workspaceDraft == null
            ? undefined
            : {
                createWorktree: workspaceDraft.createWorktree,
                branch: workspaceDraft.branch
              }
        })

        await insertSessionIntoCache(newSession)

        navigateWithCurrentSearch(`/session/${newSession.id}`)
        return true
      } catch (err) {
        console.error(err)
        setIsCreating(false)
        void message.error(getApiErrorMessage(err, 'Failed to create session'))
        return false
      }
    }

    connectionManager.send(session.id, {
      type: 'user_message',
      content
    })
    return true
  }, [
    adapter,
    hasAvailableModels,
    insertSessionIntoCache,
    isThinking,
    navigateWithCurrentSearch,
    message,
    effort,
    permissionMode,
    workspaceDraft,
    modelForQuery,
    session?.id,
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
      const { session: newSession } = await branchSessionFromMessage(session.id, messageId, action, options)
      await insertSessionIntoCache(newSession)
      navigateWithCurrentSearch(`/session/${newSession.id}`)
      return true
    } catch (err) {
      console.error(err)
      void message.error(getApiErrorMessage(err, t('common.operationFailed')))
      return false
    }
  }, [insertSessionIntoCache, message, navigateWithCurrentSearch, session?.id, t])

  const forkMessage = useCallback((messageId: string) => {
    return runMessageAction(messageId, 'fork')
  }, [runMessageAction])

  const recallMessage = useCallback((messageId: string) => {
    return runMessageAction(messageId, 'recall')
  }, [runMessageAction])

  const editMessage = useCallback((messageId: string, content: string | ChatMessageContent[]) => {
    return runMessageAction(messageId, 'edit', { content })
  }, [runMessageAction])

  return {
    isCreating,
    isThinking,
    send,
    sendContent,
    editMessage,
    forkMessage,
    interrupt,
    clearMessages,
    recallMessage
  }
}
