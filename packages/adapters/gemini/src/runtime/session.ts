import type { AdapterCtx, AdapterQueryOptions, AdapterSession } from '@vibe-forge/types'

import { createDirectGeminiSession } from './session/direct'
import { createStreamGeminiSession } from './session/stream'

export const createGeminiSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => (
  options.mode === 'direct'
    ? createDirectGeminiSession(ctx, options)
    : createStreamGeminiSession(ctx, options)
)
