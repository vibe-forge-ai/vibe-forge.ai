import type { ChatMessage } from '@vibe-forge/core'
import type { SessionInfo } from '@vibe-forge/types'

import type { ChatErrorState, InteractionRequestState } from './interaction-state'

export interface ChatSessionViewSnapshot {
  messages: ChatMessage[]
  sessionInfo: SessionInfo | null
  errorState: ChatErrorState | null
  interactionRequest: InteractionRequestState | null
  isHydrated: boolean
}

export const createChatSessionViewSnapshot = (
  value?: Partial<ChatSessionViewSnapshot>
): ChatSessionViewSnapshot => ({
  messages: value?.messages ?? [],
  sessionInfo: value?.sessionInfo ?? null,
  errorState: value?.errorState ?? null,
  interactionRequest: value?.interactionRequest ?? null,
  isHydrated: value?.isHydrated ?? false
})

export const mergeChatSessionViewSnapshot = (
  current: ChatSessionViewSnapshot | undefined,
  patch: Partial<ChatSessionViewSnapshot>
): ChatSessionViewSnapshot => {
  return createChatSessionViewSnapshot({
    ...createChatSessionViewSnapshot(current),
    ...patch
  })
}

export const restoreChatSessionViewSnapshot = (snapshot?: ChatSessionViewSnapshot) => {
  const resolved = createChatSessionViewSnapshot(snapshot)

  return {
    messages: resolved.messages,
    sessionInfo: resolved.sessionInfo,
    errorState: resolved.errorState,
    interactionRequest: resolved.interactionRequest,
    isReady: resolved.isHydrated
  }
}
