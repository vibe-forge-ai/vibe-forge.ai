import type { AdapterCtx, AdapterQueryOptions, AdapterSession } from '@vibe-forge/types'

import { createDirectCopilotSession } from './session/direct'
import { createStreamCopilotSession } from './session/stream'

export const createCopilotSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => (
  options.mode === 'direct'
    ? createDirectCopilotSession(ctx, options)
    : createStreamCopilotSession(ctx, options)
)
