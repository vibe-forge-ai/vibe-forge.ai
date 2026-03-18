import { App } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSWRConfig } from 'swr'

import { createSession, getApiErrorMessage } from '#~/api.js'
import { connectionManager } from '#~/connectionManager.js'
import type { ChatMessageContent, Session } from '@vibe-forge/core'
import type { PermissionMode } from './use-chat-permission-mode'

export function useChatSessionActions({
  session,
  modelForQuery,
  hasAvailableModels,
  permissionMode,
  adapter,
  onClearMessages
}: {
  session?: Session
  modelForQuery?: string
  hasAvailableModels: boolean
  permissionMode: PermissionMode
  adapter?: string
  onClearMessages: () => void
}) {
  const { message } = App.useApp()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { mutate } = useSWRConfig()
  const [isCreating, setIsCreating] = useState(false)
  const isThinking = isCreating || session?.status === 'running'

  const send = useCallback(async (text: string) => {
    if (text.trim() === '' || isThinking) return
    if (!hasAvailableModels) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }

    if (!session?.id) {
      setIsCreating(true)
      try {
        const { session: newSession } = await createSession(undefined, text.trim(), undefined, modelForQuery, {
          permissionMode,
          adapter
        })

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
        void message.error(getApiErrorMessage(err, 'Failed to create session'))
      }
      return
    }

    connectionManager.send(session.id, {
      type: 'user_message',
      text: text.trim()
    })
  }, [
    adapter,
    hasAvailableModels,
    isThinking,
    message,
    mutate,
    navigate,
    permissionMode,
    modelForQuery,
    session?.id,
    t
  ])

  const sendContent = useCallback(async (content: ChatMessageContent[]) => {
    if (content.length === 0 || isThinking) return
    if (!hasAvailableModels) {
      void message.warning(t('chat.modelConfigRequired'))
      return
    }

    if (!session?.id) {
      setIsCreating(true)
      try {
        const { session: newSession } = await createSession(undefined, undefined, content, modelForQuery, {
          permissionMode,
          adapter
        })

        await mutate('/api/sessions', (prev: { sessions: Session[] } | undefined) => {
          if (!prev?.sessions) return { sessions: [newSession] }
          return {
            ...prev,
            sessions: [newSession, ...prev.sessions]
          }
        }, false)

        void navigate(`/session/${newSession.id}`)
        setIsCreating(false)
      } catch (err) {
        console.error(err)
        setIsCreating(false)
        void message.error(getApiErrorMessage(err, 'Failed to create session'))
      }
      return
    }

    connectionManager.send(session.id, {
      type: 'user_message',
      content
    })
  }, [
    adapter,
    hasAvailableModels,
    isThinking,
    message,
    mutate,
    navigate,
    permissionMode,
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

  return {
    isCreating,
    isThinking,
    send,
    sendContent,
    interrupt,
    clearMessages
  }
}
