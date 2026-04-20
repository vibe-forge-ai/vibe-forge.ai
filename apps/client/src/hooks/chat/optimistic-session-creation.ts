import { atom } from 'jotai'

import type {
  ChatMessage,
  ChatMessageContent,
  EffortLevel,
  Session,
  SessionPermissionMode,
  SessionPromptType
} from '@vibe-forge/core'
import type { GitBranchKind, SessionEntryContext } from '@vibe-forge/types'

export interface OptimisticSessionCreationOptions {
  start?: boolean
  parentSessionId?: string
  id: string
  promptType?: SessionPromptType
  promptName?: string
  effort?: EffortLevel
  permissionMode?: SessionPermissionMode
  adapter?: string
  account?: string
  entryContext?: SessionEntryContext
  workspace?: {
    createWorktree?: boolean
    worktreeEnvironment?: string
    branch?: {
      name: string
      kind?: GitBranchKind
      mode?: 'checkout' | 'create'
    }
  }
}

export interface OptimisticSessionCreationRequest {
  id: string
  title?: string
  initialMessage?: string
  initialContent?: ChatMessageContent[]
  model?: string
  options: OptimisticSessionCreationOptions
}

export interface OptimisticSessionCreation {
  errorMessage?: string
  message: ChatMessage
  request: OptimisticSessionCreationRequest
  session: Session
  status: 'creating' | 'failed'
}

export type OptimisticSessionCreationMap = Record<string, OptimisticSessionCreation>

export const optimisticSessionCreationsAtom = atom<OptimisticSessionCreationMap>({})

const discardedOptimisticSessionIds = new Set<string>()

export const markOptimisticSessionDiscarded = (id: string) => {
  discardedOptimisticSessionIds.add(id)
}

export const clearOptimisticSessionDiscarded = (id: string) => {
  discardedOptimisticSessionIds.delete(id)
}

export const isOptimisticSessionDiscarded = (id: string) => {
  return discardedOptimisticSessionIds.has(id)
}

export const createOptimisticSessionId = () => {
  return globalThis.crypto?.randomUUID != null
    ? globalThis.crypto.randomUUID()
    : `local-session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const getContentPreview = (content?: string | ChatMessageContent[]) => {
  if (typeof content === 'string') {
    return content.trim()
  }

  const textItem = content?.find(
    (item): item is Extract<ChatMessageContent, { type: 'text' }> => item.type === 'text' && item.text.trim() !== ''
  )
  if (textItem != null) {
    return textItem.text.trim()
  }

  const fileItem = content?.find(
    (item): item is Extract<ChatMessageContent, { type: 'file' }> => item.type === 'file' && item.path.trim() !== ''
  )
  if (fileItem != null) {
    return fileItem.path.trim()
  }

  const imageItem = content?.find((item): item is Extract<ChatMessageContent, { type: 'image' }> =>
    item.type === 'image'
  )
  if (imageItem != null) {
    return imageItem.name?.trim() ?? ''
  }

  return ''
}

const getTitlePreview = (contentPreview: string) => {
  const firstLine = contentPreview.split('\n')[0]?.trim() ?? ''
  if (firstLine === '') return undefined
  return firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine
}

export const createOptimisticSessionCreation = (
  request: OptimisticSessionCreationRequest,
  now = Date.now()
): OptimisticSessionCreation => {
  const content = request.initialContent ?? request.initialMessage ?? ''
  const contentPreview = getContentPreview(content)
  const title = request.title ?? getTitlePreview(contentPreview)

  return {
    message: {
      id: `${request.id}:optimistic-user-message`,
      role: 'user',
      content,
      createdAt: now
    },
    request,
    session: {
      id: request.id,
      title,
      createdAt: now,
      messageCount: 1,
      lastMessage: contentPreview === '' ? undefined : contentPreview,
      lastUserMessage: contentPreview === '' ? undefined : contentPreview,
      isArchived: false,
      isStarred: false,
      tags: [],
      status: 'running',
      model: request.model,
      adapter: request.options.adapter,
      account: request.options.account,
      permissionMode: request.options.permissionMode,
      effort: request.options.effort,
      promptType: request.options.promptType,
      promptName: request.options.promptName
    },
    status: 'creating'
  }
}

export const markOptimisticSessionCreationCreating = (
  creation: OptimisticSessionCreation
): OptimisticSessionCreation => ({
  ...creation,
  errorMessage: undefined,
  session: {
    ...creation.session,
    status: 'running'
  },
  status: 'creating'
})

export const markOptimisticSessionCreationFailed = (
  creation: OptimisticSessionCreation,
  errorMessage: string
): OptimisticSessionCreation => ({
  ...creation,
  errorMessage,
  session: {
    ...creation.session,
    status: 'failed'
  },
  status: 'failed'
})

export const mergeOptimisticSessions = (
  sessions: Session[],
  creations: OptimisticSessionCreationMap
) => {
  const existingIds = new Set(sessions.map(session => session.id))
  const mergedSessions = sessions.map(session => creations[session.id]?.session ?? session)
  const optimisticSessions = Object.values(creations)
    .map(creation => creation.session)
    .filter(session => session.isArchived !== true && !existingIds.has(session.id))

  return [...mergedSessions, ...optimisticSessions]
}

export const removeSessionFromList = (sessions: Session[], id: string) => {
  return sessions.filter(session => session.id !== id)
}
