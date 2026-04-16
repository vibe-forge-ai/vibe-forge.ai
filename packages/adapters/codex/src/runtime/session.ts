import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'

import { createDirectCodexSession } from './direct'
import { resolveSessionBase } from './session-common'
import { createStreamCodexSession } from './stream'
import { createCodexTranscriptHookWatcher } from './transcript-hooks'

/**
 * Create a codex adapter session, dispatching to `direct` or `stream` mode
 * based on `options.mode` (default: `'stream'`).
 */
export const createCodexSession = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const base = await resolveSessionBase(ctx, options)
  let didStopTranscriptHookWatcher = false
  let transcriptHookWatcher: ReturnType<typeof createCodexTranscriptHookWatcher> | undefined
  const stopTranscriptHookWatcher = () => {
    if (didStopTranscriptHookWatcher) return
    didStopTranscriptHookWatcher = true
    transcriptHookWatcher?.stop()
  }
  const wrappedOnEvent: typeof options.onEvent = (event) => {
    if (event.type === 'exit') {
      stopTranscriptHookWatcher()
    }
    options.onEvent(event)
  }

  transcriptHookWatcher = base.spawnEnv.__VF_VIBE_FORGE_CODEX_HOOKS_ACTIVE__ === '1'
    ? createCodexTranscriptHookWatcher({
      callHooks: false,
      cwd: ctx.cwd,
      emitEvents: true,
      env: ctx.env,
      homeDir: base.spawnEnv.HOME,
      logger: ctx.logger,
      onEvent: wrappedOnEvent,
      runtime: options.runtime,
      sessionId: options.sessionId
    })
    : undefined

  transcriptHookWatcher?.start()

  wrappedOnEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model: base.resolvedModel ?? options.model ?? 'default',
      effort: base.effectiveEffort,
      version: 'unknown',
      tools: [],
      slashCommands: [],
      cwd: ctx.cwd,
      agents: [],
      assetDiagnostics: options.assetPlan?.diagnostics
    }
  })
  try {
    const session = options.mode === 'direct'
      ? createDirectCodexSession(base, {
        ...options,
        onEvent: wrappedOnEvent
      })
      : await createStreamCodexSession(base, ctx, {
        ...options,
        onEvent: wrappedOnEvent
      })

    return {
      ...session,
      kill: () => {
        stopTranscriptHookWatcher()
        session.kill()
      }
    }
  } catch (error) {
    stopTranscriptHookWatcher()
    throw error
  }
}
