import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions } from '#~/adapter/index.js'
import { loadAdapter } from '#~/adapter/index.js'
import type { ModelServiceConfig } from '#~/config.js'
import { createAdapterHookBridge } from '#~/hooks/bridge.js'
import { callHook } from '#~/hooks/call.js'
import type { HookInputs } from '#~/hooks/type.js'
import { buildAdapterAssetPlan } from '#~/utils/workspace-assets.js'
import type { TaskDetail } from '#~/types.js'

import { prepare } from './prepare'
import type { RunTaskOptions } from './type'

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const pickFirstNonEmptyString = (values: unknown[]) =>
  values
    .map(normalizeNonEmptyString)
    .find((value): value is string => value != null)

const resolveQueryModel = (params: {
  config: AdapterCtx['configs'][0]
  userConfig: AdapterCtx['configs'][1]
  inputModel?: string
}) => {
  const inputModel = normalizeNonEmptyString(params.inputModel)
  // User explicitly provided a model → pass through as-is.
  // The adapter decides CCR vs native based on whether it contains ",".
  if (inputModel != null) return inputModel

  // No explicit model → auto-resolve from modelServices config.
  // Produces "service,model" format when services are configured,
  // which signals the adapter to route through CCR.
  const mergedModelServices = {
    ...(params.config?.modelServices ?? {}),
    ...(params.userConfig?.modelServices ?? {})
  }
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

  const serviceEntries = Object.entries(mergedModelServices)
  const modelToService = new Map<string, string>()
  const availableModels: string[] = []
  for (const [serviceKey, serviceValue] of serviceEntries) {
    const service = (serviceValue != null && typeof serviceValue === 'object')
      ? serviceValue as ModelServiceConfig
      : undefined
    const models = Array.isArray(service?.models)
      ? service?.models.filter(item => typeof item === 'string' && item.trim() !== '')
      : []
    for (const model of models) {
      if (!modelToService.has(model)) modelToService.set(model, serviceKey)
      availableModels.push(model)
    }
  }

  if (availableModels.length === 0) return undefined

  const resolveDefaultModel = () => {
    if (mergedDefaultModel && modelToService.has(mergedDefaultModel)) return mergedDefaultModel
    if (mergedDefaultModelService && mergedModelServices[mergedDefaultModelService]) {
      const service = mergedModelServices[mergedDefaultModelService] as ModelServiceConfig | undefined
      const models = Array.isArray(service?.models)
        ? service?.models.filter((item: unknown) => typeof item === 'string' && (item as string).trim() !== '')
        : []
      if (models.length > 0) return models[0]
    }
    return availableModels[0]
  }

  const resolvedModel = resolveDefaultModel()
  if (!resolvedModel) return undefined

  const resolvedService = modelToService.get(resolvedModel) ??
    mergedDefaultModelService ??
    serviceEntries[0]?.[0]

  return resolvedService ? `${resolvedService},${resolvedModel}` : resolvedModel
}

declare module '@vibe-forge/core' {
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

  const adapters = {
    ...config?.adapters,
    ...userConfig?.adapters
  }
  // dprint-ignore
  const adapterType =
    // 0. adapter from options
    options.adapter ??
    // 1. config default adapter
    config?.defaultAdapter ??
    // 2. user config default adapter
    userConfig?.defaultAdapter ??
    // 3. first adapter in config
    (() => {
      const adapterNames = Object.keys(adapters)
      if (adapterNames.length === 0) {
        throw new Error('No adapter found in config, please set adapters in config file')
      }
      return adapterNames[0]
    })()

  const adapter = await loadAdapter(adapterType)
  await adapter.init?.(ctx)

  const resolvedModel = resolveQueryModel({
    config,
    userConfig,
    inputModel: adapterOptions.model
  })

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
  const nativeBridgeDisabledEvents: Array<keyof HookInputs> = (
    adapterType === 'codex' && ctx.env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
      : adapterType === 'claude-code' && ctx.env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ === '1'
        ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
        : adapterType === 'opencode' && ctx.env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ === '1'
          ? OPENCODE_NATIVE_BRIDGE_DISABLED_EVENTS
          : []
  )
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
