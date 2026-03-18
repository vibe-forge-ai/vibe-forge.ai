import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/core/adapter'

import { createDirectCodexSession } from './direct'
import { resolveSessionBase } from './session-common'
import { createStreamCodexSession } from './stream'

/**
 * Create a codex adapter session, dispatching to `direct` or `stream` mode
 * based on `options.mode` (default: `'stream'`).
 */
export const createCodexSession = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const base = await resolveSessionBase(ctx, options)
  return options.mode === 'direct'
    ? createDirectCodexSession(base, options)
    : createStreamCodexSession(base, ctx, options)
}
