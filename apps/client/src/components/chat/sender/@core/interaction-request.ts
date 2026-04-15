import type { AskUserQuestionParams } from '@vibe-forge/core'

export const shouldHideSenderForInteraction = (
  _interactionRequest: { id: string; payload: AskUserQuestionParams } | null | undefined
) => false
