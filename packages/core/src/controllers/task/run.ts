import type { AdapterCtx, AdapterOutputEvent, AdapterQueryOptions } from '#~/adapter/index.js'
import { loadAdapter } from '#~/adapter/index.js'
import type { ModelServiceConfig } from '#~/config.js'
import type { TaskDetail } from '#~/types.js'
import { callHook } from '#~/utils/api.js'

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
  // "default" or "default,xxxModel" → pass through directly to the adapter
  // so it can bypass the CCR relay and use the native claude binary
  if (inputModel === 'default' || inputModel?.startsWith('default,')) return inputModel
  if (inputModel?.includes(',')) return inputModel

  const mergedModelServices = {
    ...(params.config?.modelServices ?? {}),
    ...(params.userConfig?.modelServices ?? {})
  }
  const mergedDefaultModel = pickFirstNonEmptyString([params.userConfig?.defaultModel, params.config?.defaultModel])
  const mergedDefaultModelService = pickFirstNonEmptyString([
    params.userConfig?.defaultModelService,
    params.config?.defaultModelService
  ])

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

  const resolveDefaultModel = () => {
    if (availableModels.length === 0) return undefined
    if (mergedDefaultModel && modelToService.has(mergedDefaultModel)) return mergedDefaultModel
    if (mergedDefaultModelService && mergedModelServices[mergedDefaultModelService]) {
      const service = mergedModelServices[mergedDefaultModelService]
      const models = Array.isArray(service?.models)
        ? service?.models.filter(item => typeof item === 'string' && item.trim() !== '')
        : []
      if (models.length > 0) return models[0]
    }
    return availableModels[0]
  }

  const resolvedModel = inputModel ?? resolveDefaultModel()
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

  const originalOnEvent = adapterOptions.onEvent
  const wrappedOnEvent = (event: AdapterOutputEvent) => {
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

  const adapter = await loadAdapter(adapterType)
  const resolvedModel = resolveQueryModel({
    config,
    userConfig,
    inputModel: adapterOptions.model
  })

  await callHook('TaskStart', {
    adapter: adapterType,
    cwd: ctx.cwd,
    sessionId: adapterOptions.sessionId,

    options,
    adapterOptions
  }, ctx.env)
  const session = await adapter.query(
    ctx,
    {
      ...adapterOptions,
      model: resolvedModel,
      onEvent: wrappedOnEvent
    }
  )

  return { session, ctx }
}
