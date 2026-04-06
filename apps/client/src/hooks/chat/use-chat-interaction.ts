import { useCallback, useState } from 'react'

import { respondSessionInteraction } from '#~/api/sessions'
import type { AskUserQuestionParams } from '@vibe-forge/core'

export function useChatInteraction({
  sessionId
}: {
  sessionId?: string
}) {
  const [interactionRequest, setInteractionRequest] = useState<{ id: string; payload: AskUserQuestionParams } | null>(
    null
  )

  const handleInteractionResponse = useCallback((id: string, data: string | string[]) => {
    if (!sessionId) return
    void respondSessionInteraction(sessionId, id, data)
      .then(() => {
        setInteractionRequest(current => (current?.id === id ? null : current))
      })
      .catch((error) => {
        console.error('Failed to submit interaction response:', error)
      })
  }, [sessionId])

  return {
    interactionRequest,
    setInteractionRequest,
    handleInteractionResponse
  }
}
