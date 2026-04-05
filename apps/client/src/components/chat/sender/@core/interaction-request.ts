import type { AskUserQuestionParams } from '@vibe-forge/core'

export const shouldHideSenderForInteraction = (
  interactionRequest: { id: string; payload: AskUserQuestionParams } | null | undefined
) => interactionRequest?.payload.kind === 'permission'
