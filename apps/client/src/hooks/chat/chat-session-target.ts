import type { Session } from '@vibe-forge/core'
import type { SessionPromptType } from '@vibe-forge/types'

export type ChatSessionTargetType = 'default' | SessionPromptType

export interface ChatSessionTargetDraft {
  type: ChatSessionTargetType
  name?: string
  label?: string
  description?: string
  path?: string
}

export interface ChatSessionTargetResource {
  id: string
  name: string
  description?: string
  path?: string
}

export const DEFAULT_CHAT_SESSION_TARGET_DRAFT: ChatSessionTargetDraft = {
  type: 'default'
}

export const isChatSessionTargetReady = (target?: ChatSessionTargetDraft) => (
  target == null || target.type === 'default' || (target.name?.trim() ?? '') !== ''
)

export const getChatSessionTargetPrompt = (target?: ChatSessionTargetDraft): {
  promptType?: SessionPromptType
  promptName?: string
} => {
  if (target == null || target.type === 'default') {
    return {}
  }

  const promptName = target.name?.trim()
  if (promptName == null || promptName === '') {
    return {}
  }

  return {
    promptType: target.type,
    promptName
  }
}

export const createChatSessionTargetDraft = (
  type: Exclude<ChatSessionTargetType, 'default'>,
  resource: ChatSessionTargetResource
): ChatSessionTargetDraft => ({
  type,
  name: type === 'workspace' ? resource.id : resource.name,
  label: resource.name,
  description: resource.description,
  path: resource.path
})

export const getChatSessionTargetDraftFromSession = (session?: Session): ChatSessionTargetDraft => {
  if (session?.promptType == null) {
    return DEFAULT_CHAT_SESSION_TARGET_DRAFT
  }

  return {
    type: session.promptType,
    name: session.promptName,
    label: session.promptName
  }
}
