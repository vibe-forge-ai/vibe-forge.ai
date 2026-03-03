import { useCallback, useState } from 'react'

import type { AskUserQuestionParams } from '@vibe-forge/core'
import { connectionManager } from '../../connectionManager'

export function useChatInteraction({ sessionId }: { sessionId?: string }) {
  const [interactionRequest, setInteractionRequest] = useState<{ id: string; payload: AskUserQuestionParams } | null>(
    null
  )

  const handleInteractionResponse = useCallback((id: string, data: string | string[]) => {
    if (!sessionId) return
    connectionManager.send(sessionId, {
      type: 'interaction_response',
      id,
      data
    })
    setInteractionRequest(null)
  }, [sessionId])

  return {
    interactionRequest,
    setInteractionRequest,
    handleInteractionResponse
  }
}
