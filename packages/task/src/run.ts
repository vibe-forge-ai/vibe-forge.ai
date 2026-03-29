import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions, AdapterModelFallbackError, TaskDetail  } from '@vibe-forge/types'
import { loadAdapter } from '@vibe-forge/types'
import { callHook, createAdapterHookBridge } from '@vibe-forge/hooks'
import type { HookInputs } from '@vibe-forge/hooks'
import { buildAdapterAssetPlan } from '@vibe-forge/workspace-assets'
import {
  listServiceModels,
  mergeAdapterConfigs,
  normalizeNonEmptyString,
  resolveAdapterConfiguredDefaultModel,
  resolveAdapterModelCompatibility,
  resolveDefaultModelSelection,
  resolveModelDefaultAdapter,
  resolveModelSelection
} from '@vibe-forge/utils'

import { prepare } from '#~/prepare.js'
import type { RunTaskOptions } from '#~/type.js'

const pickFirstNonEmptyString = (values: unknown[]) =>
  values
    .map(normalizeNonEmptyString)
    .find((value): value is string => value != null)

const formatAdapterModelRuleSuffix = (params: {
  includeModels?: string[]
  excludeModels?: string[]
}) => {
  const parts = []
  if (params.includeModels != null && params.includeModels.length > 0) {
    parts.push(`includeModels=${params.includeModels.join(', ')}`)
  }
  if (params.excludeModels != null && params.excludeModels.length > 0) {
    parts.push(`excludeModels=${params.excludeModels.join(', ')}`)
  }
  return parts.length > 0 ? ` (${parts.join('; ')})` : ''
}

const formatAdapterModelFallbackError = (error: AdapterModelFallbackError) => {
  const ruleSuffix = formatAdapterModelRuleSuffix({
    includeModels: error.includeModels,
    excludeModels: error.excludeModels
  })

  if (error.type === 'missing_default_model') {
    return `Model "${error.requestedModel}" is not allowed for adapter "${error.adapter}"${ruleSuffix}. Configure adapters.${error.adapter}.defaultModel to continue.`
  }

  return `Adapter "${error.adapter}" defaultModel "${error.defaultModel}" is also not allowed${ruleSuffix}.`
}

const resolveQuerySelection = (params: {
  config: AdapterCtx['configs'][0]
  userConfig: AdapterCtx['configs'][1]
  inputAdapter?: string
  inputModel?: string
}) => {
  const mergedAdapters = mergeAdapterConfigs(
    params.config?.adapters as Record<string, unknown> | undefined,
    params.userConfig?.adapters as Record<string, unknown> | undefined
  )
  const mergedModels = {
    ...(params.config?.models ?? {}),
    ...(params.userConfig?.models ?? {})
  }
  const mergedModelServices = {
    ...(params.config?.modelServices ?? {}),
    ...(params.userConfig?.modelServices ?? {})
  }
  const availableAdapters = Object.keys(mergedAdapters ?? {})
  const serviceModels = listServiceModels(mergedModelServices)
  const explicitAdapter = normalizeNonEmptyString(params.inputAdapter)
  const explicitModel = resolveModelSelection({
    value: params.inputModel,
    serviceModels,
    preserveUnknown: true
  })
  const mergedDefaultAdapter = pickFirstNonEmptyString(
    [
      params.userConfig?.defaultAdapter,
      params.config?.defaultAdapter
    ]
  )
  const mergedDefaultModel = pickFirstNonEmptyString(
    [
      params.userConfig?.defaultModel,
      params.config?.defaultModel
    ]
  )
  const mergedDefaultModelService = pickFirstNonEmptyString(
    [
      params.userConfig?.defaultModelService,
      params.config?.defaultModelService
    ]
  )
  const resolvedDefaultModel = resolveDefaultModelSelection({
    defaultModel: mergedDefaultModel,
    defaultModelService: mergedDefaultModelService,
    serviceModels,
    preserveUnknownDefaultModel: true
  })

  const resolveAdapterFallback = () => explicitAdapter ?? mergedDefaultAdapter ?? availableAdapters[0]

  const resolveAdapterForModel = (model: string) => (
    explicitAdapter ??
    resolveModelDefaultAdapter({
      model,
      models: mergedModels
    }) ??
    mergedDefaultAdapter ??
    availableAdapters[0]
  )

  const resolveModelForAdapter = (adapter: string | undefined) => {
    const adapterConfiguredModel = resolveAdapterConfiguredDefaultModel({
      adapterConfig: adapter != null ? mergedAdapters?.[adapter] : undefined,
      serviceModels,
      preferredServiceKey: mergedDefaultModelService,
      preserveUnknown: true
    })
    return adapterConfiguredModel ?? resolvedDefaultModel
  }

  if (explicitModel != null) {
    return {
      adapter: resolveAdapterForModel(explicitModel),
      model: explicitModel
    }
  }

  if (explicitAdapter != null) {
    return {
      adapter: explicitAdapter,
      model: resolveModelForAdapter(explicitAdapter)
    }
  }

  if (resolvedDefaultModel != null) {
    return {
      adapter: resolveAdapterForModel(resolvedDefaultModel),
      model: resolvedDefaultModel
    }
  }

  const adapter = resolveAdapterFallback()
  return {
    adapter,
    model: resolveModelForAdapter(adapter)
  }
}

declare module '@vibe-forge/types' {
  interface Cache {
    base: Omit<AdapterCtx, 'logger' | 'cache'>
    detail: TaskDetail
  }
}

const BASE_NATIVE_BRIDGE_DISABLED_EVENTS: Array<
  'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop'
> = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']

const OPENCODE_NATIVE_BRIDGE_DISABLED_EVENTS: Array<
  'SessionStart' | 'PreToolUse' | 'PostToolUse' | 'Stop'
> = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop']

export const run = async (
  options: RunTaskOptions,
  adapterOptions: AdapterQueryOptions
) => {
  const [ctx] = await prepare(options, adapterOptions)
  const {
    configs: [config, userConfig]
  } = ctx

  const { logger, cache, ...base } = ctx

  await cache.set('base', base)

  const resolvedSelection = resolveQuerySelection({
    config,
    userConfig,
    inputAdapter: options.adapter,
    inputModel: adapterOptions.model
  })
  const adapterType = resolvedSelection.adapter
  if (adapterType == null) {
    throw new Error('No adapter found in config, please set adapters in config file')
  }

  const mergedAdapters = mergeAdapterConfigs(
    config?.adapters as Record<string, unknown> | undefined,
    userConfig?.adapters as Record<string, unknown> | undefined
  )
  const mergedModelServices = {
    ...(config?.modelServices ?? {}),
    ...(userConfig?.modelServices ?? {})
  }
  const serviceModels = listServiceModels(mergedModelServices)
  const mergedDefaultModelService = pickFirstNonEmptyString(
    [
      userConfig?.defaultModelService,
      config?.defaultModelService
    ]
  )
  const compatibilityResult = resolveAdapterModelCompatibility({
    adapter: adapterType,
    model: resolvedSelection.model,
    adapterConfig: mergedAdapters?.[adapterType],
    serviceModels,
    preferredServiceKey: mergedDefaultModelService,
    preserveUnknownDefaultModel: true
  })
  if (compatibilityResult.error) {
    throw new Error(formatAdapterModelFallbackError(compatibilityResult.error))
  }

  const adapter = await loadAdapter(adapterType)
  await adapter.init?.(ctx)
  const resolvedModel = compatibilityResult.model ?? resolvedSelection.model
  const selectionWarnings = compatibilityResult.warning != null ? [compatibilityResult.warning] : undefined

  const originalOnEvent = adapterOptions.onEvent
  const supportedAssetPlanAdapters = new Set(['claude-code', 'codex', 'opencode'])
  const assetPlan = ctx.assets == null || !supportedAssetPlanAdapters.has(adapterType)
    ? undefined
    : buildAdapterAssetPlan({
      adapter: adapterType as 'claude-code' | 'codex' | 'opencode',
      bundle: ctx.assets,
      options: {
        mcpServers: adapterOptions.mcpServers,
        skills: adapterOptions.skills,
        promptAssetIds: adapterOptions.promptAssetIds
      }
    })
  const nativeBridgeDisabledEvents: Array<keyof HookInputs> =
    adapterType === 'codex' && ctx.env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
      : adapterType === 'claude-code' && ctx.env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
      : adapterType === 'opencode' && ctx.env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? OPENCODE_NATIVE_BRIDGE_DISABLED_EVENTS
      : []
  const hookBridge = createAdapterHookBridge({
    ctx,
    adapter: adapterType,
    runtime: adapterOptions.runtime,
    sessionId: adapterOptions.sessionId,
    type: adapterOptions.type,
    model: resolvedModel,
    disabledEvents: nativeBridgeDisabledEvents
  })
  const wrappedOnEvent = (event: AdapterOutputEvent) => {
    hookBridge.handleOutput(event)

    if (event.type === 'init') {
      originalOnEvent({
        ...event,
        data: {
          ...event.data,
          adapter: adapterType,
          selectionWarnings: selectionWarnings ?? event.data.selectionWarnings,
          assetDiagnostics: assetPlan?.diagnostics ?? event.data.assetDiagnostics
        }
      })
      return
    }

    if (event.type === 'exit') {
      const { data } = event

      void callHook('TaskStop', {
        adapter: adapterType,
        cwd: ctx.cwd,
        sessionId: adapterOptions.sessionId,

        options,
        adapterOptions,

        exitCode: data.exitCode,
        stderr: data.stderr
      }, ctx.env)
        .catch((e) => {
          logger.error('[Hook] TaskStop failed', e)
        })
    }
    originalOnEvent(event)
  }

  const taskStartOutput = await callHook('TaskStart', {
    adapter: adapterType,
    cwd: ctx.cwd,
    sessionId: adapterOptions.sessionId,

    options,
    adapterOptions
  }, ctx.env)
  if (taskStartOutput?.continue === false) {
    throw new Error(taskStartOutput.stopReason ?? 'TaskStart hook blocked task startup')
  }
  await hookBridge.start()
  const description = await hookBridge.prepareInitialPrompt(adapterOptions.description)
  const session = await adapter.query(
    ctx,
    {
      ...adapterOptions,
      assetPlan,
      description,
      model: resolvedModel,
      onEvent: wrappedOnEvent
    }
  )

  return { session: hookBridge.wrapSession(session), ctx }
}
