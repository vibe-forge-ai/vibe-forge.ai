import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'

import { createDirectCodexSession } from './direct'
import { unregisterProxyCatalog } from './proxy'
import { resolveSessionBase } from './session-common'
import { createStreamCodexSession } from './stream'
import { createCodexTranscriptHookWatcher } from './transcript-hooks'

/**
 * Create a codex adapter session, dispatching to `direct` or `stream` mode
 * based on `options.mode` (default: `'stream'`).
 */
export const createCodexSession = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const base = await resolveSessionBase(ctx, options)
  const transcriptHookWatcher = base.spawnEnv.__VF_VIBE_FORGE_CODEX_HOOKS_ACTIVE__ === '1'
    ? createCodexTranscriptHookWatcher({
      cwd: ctx.cwd,
      env: ctx.env,
      homeDir: base.spawnEnv.HOME,
      logger: ctx.logger,
      runtime: options.runtime,
      sessionId: options.sessionId
    })
    : undefined
  let didStopTranscriptHookWatcher = false
  let didCleanupProxyCatalog = false
  const stopTranscriptHookWatcher = () => {
    if (didStopTranscriptHookWatcher) return
    didStopTranscriptHookWatcher = true
    transcriptHookWatcher?.stop()
  }
  const cleanupProxyCatalog = () => {
    if (didCleanupProxyCatalog) return
    didCleanupProxyCatalog = true
    if (base.proxyCatalogSessionKey != null) {
      unregisterProxyCatalog(base.proxyCatalogSessionKey)
    }
  }

  if (base.proxyCatalog != null) {
    base.proxyCatalog.onSelectorChange = (newSelector: string) => {
      options.onEvent({
        type: 'config_update',
        data: {
          source: 'native_model_switch',
          model: newSelector
        }
      })
    }
  }

  if (base.modelFallback != null) {
    options.onEvent({
      type: 'config_update',
      data: {
        source: 'native_model_switch',
        model: base.modelFallback
      }
    })
  }

  const wrappedOnEvent: typeof options.onEvent = (event) => {
    if (event.type === 'exit') {
      stopTranscriptHookWatcher()
      cleanupProxyCatalog()
    }
    options.onEvent(event)
  }

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
        cleanupProxyCatalog()
        session.kill()
      }
    }
  } catch (error) {
    stopTranscriptHookWatcher()
    cleanupProxyCatalog()
    throw error
  }
}
