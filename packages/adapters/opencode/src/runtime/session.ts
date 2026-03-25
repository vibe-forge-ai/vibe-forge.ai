import type { AdapterCtx, AdapterQueryOptions, AdapterSession } from '@vibe-forge/core/adapter'

import { createDirectOpenCodeSession } from './session/direct'
import { createStreamOpenCodeSession } from './session/stream'

export const createOpenCodeSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => (
  options.mode === 'direct'
    ? createDirectOpenCodeSession(ctx, options)
    : createStreamOpenCodeSession(ctx, options)
)
