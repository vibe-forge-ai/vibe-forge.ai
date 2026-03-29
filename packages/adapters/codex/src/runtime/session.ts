import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'

import { createDirectCodexSession } from './direct'
import { resolveSessionBase } from './session-common'
import { createStreamCodexSession } from './stream'

/**
 * Create a codex adapter session, dispatching to `direct` or `stream` mode
 * based on `options.mode` (default: `'stream'`).
 */
export const createCodexSession = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const base = await resolveSessionBase(ctx, options)
  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model: base.resolvedModel ?? options.model ?? 'default',
      version: 'unknown',
      tools: [],
      slashCommands: [],
      cwd: ctx.cwd,
      agents: [],
      assetDiagnostics: options.assetPlan?.diagnostics
    }
  })
  return options.mode === 'direct'
    ? createDirectCodexSession(base, options)
    : createStreamCodexSession(base, ctx, options)
}
