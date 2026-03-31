import React, { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { getConfig } from '#~/api.js'
import { getAdapterDisplay } from '#~/resources/adapters.js'
import type {
  AdapterBuiltinModel,
  ConfigResponse,
  ModelMetadataConfig,
  ModelServiceConfig,
  RecommendedModelConfig
} from '@vibe-forge/types'
import {
  buildServiceModelSelector,
  listServiceModels,
  normalizeNonEmptyString,
  resolveAdapterForChatModelSelection,
  resolveAdapterModelCompatibility,
  resolveChatAdapterSelection,
  resolveChatModelSelection,
  resolveDefaultChatModelSelection,
  resolveModelForChatAdapterSelection,
  resolveServiceModelSelector
} from './model-selector'

export interface ModelSelectOption {
  value: string
  label: React.ReactNode
  searchText: string
  displayLabel: string
}

export interface ModelSelectGroup {
  label: React.ReactNode
  options: ModelSelectOption[]
}

type SelectionDriver = 'adapter' | 'model'

const ADAPTER_STORAGE_KEY = 'vf_chat_adapter'
const MODEL_STORAGE_KEY = 'vf_chat_selected_model'
const DRIVER_STORAGE_KEY = 'vf_chat_selection_driver'

const readStorageValue = (key: string) => {
  try {
    const raw = localStorage.getItem(key)
    return raw == null || raw.trim() === '' ? undefined : raw
  } catch {
    return undefined
  }
}

const readSelectionDriver = (): SelectionDriver => {
  const raw = readStorageValue(DRIVER_STORAGE_KEY)
  return raw === 'model' ? 'model' : 'adapter'
}

const buildBuiltinModelValues = (models: AdapterBuiltinModel[] | undefined) => (
  Array.isArray(models) ? models.map(model => model.value) : []
)

export function useChatModelAdapterSelection({
  adapterLocked = false
}: {
  adapterLocked?: boolean
} = {}) {
  const { t } = useTranslation()
  const [selectedAdapter, setSelectedAdapter] = useState<string | undefined>(() =>
    readStorageValue(ADAPTER_STORAGE_KEY)
  )
  const [selectedModel, setSelectedModel] = useState<string | undefined>(() => readStorageValue(MODEL_STORAGE_KEY))
  const [selectionDriver, setSelectionDriver] = useState<SelectionDriver>(() => readSelectionDriver())
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)

  const mergedAdapters = useMemo(() => {
    return (configRes?.sources?.merged?.adapters ?? {}) as Record<string, unknown>
  }, [configRes?.sources?.merged?.adapters])

  const mergedModels = useMemo(() => {
    return (configRes?.sources?.merged?.models ?? {}) as Record<string, ModelMetadataConfig>
  }, [configRes?.sources?.merged?.models])

  const mergedModelServices = useMemo(() => {
    return (configRes?.sources?.merged?.modelServices ?? {}) as Record<string, ModelServiceConfig>
  }, [configRes?.sources?.merged?.modelServices])

  const recommendedModels = useMemo(() => {
    const raw = configRes?.sources?.merged?.general?.recommendedModels
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is RecommendedModelConfig => (
      item != null && typeof item === 'object' && typeof item.model === 'string' && item.model.trim() !== ''
    ))
  }, [configRes?.sources?.merged?.general?.recommendedModels])

  const adapterBuiltinModels = useMemo(() => {
    return (configRes?.sources?.merged?.adapterBuiltinModels ?? {}) as Record<string, AdapterBuiltinModel[]>
  }, [configRes?.sources?.merged?.adapterBuiltinModels])

  const defaultAdapter = normalizeNonEmptyString(configRes?.sources?.merged?.general?.defaultAdapter)
  const defaultModelService = normalizeNonEmptyString(configRes?.sources?.merged?.general?.defaultModelService)
  const defaultModel = normalizeNonEmptyString(configRes?.sources?.merged?.general?.defaultModel)

  const availableAdapters = useMemo(() => Object.keys(mergedAdapters), [mergedAdapters])
  const availableServiceModels = useMemo(() => listServiceModels(mergedModelServices), [mergedModelServices])
  const allBuiltinModelValues = useMemo(() => (
    Object.values(adapterBuiltinModels).flatMap(models => buildBuiltinModelValues(models))
  ), [adapterBuiltinModels])
  const activeBuiltinModels = useMemo(() => {
    if (selectedAdapter && adapterBuiltinModels[selectedAdapter]) {
      return { [selectedAdapter]: adapterBuiltinModels[selectedAdapter] }
    }
    return adapterBuiltinModels
  }, [adapterBuiltinModels, selectedAdapter])
  const activeBuiltinModelValues = useMemo(() => (
    Object.values(activeBuiltinModels).flatMap(models => buildBuiltinModelValues(models))
  ), [activeBuiltinModels])
  const hasAvailableModels = availableServiceModels.length > 0 || activeBuiltinModelValues.length > 0

  const resolveAdapterValue = useCallback((value?: string) => {
    return resolveChatAdapterSelection({
      value,
      availableAdapters,
      defaultAdapter
    })
  }, [availableAdapters, defaultAdapter])

  const resolveSelectableModel = useCallback(
    (value?: string, builtinModels?: Iterable<string>, preserveUnknown = false) => {
      return resolveChatModelSelection({
        value,
        builtinModels,
        serviceModels: availableServiceModels,
        defaultModelService,
        preserveUnknown
      })
    },
    [availableServiceModels, defaultModelService]
  )

  const resolveModelForAdapter = useCallback((adapter?: string) => {
    const builtinModels = buildBuiltinModelValues(
      adapter != null ? adapterBuiltinModels[adapter] : undefined
    )
    const resolvedModel = resolveModelForChatAdapterSelection({
      adapter,
      adapters: mergedAdapters,
      defaultModel,
      defaultModelService,
      builtinModels,
      fallbackBuiltinModels: allBuiltinModelValues,
      serviceModels: availableServiceModels
    })
    if (!adapter || !resolvedModel) return resolvedModel

    const compatibility = resolveAdapterModelCompatibility({
      adapter,
      model: resolvedModel,
      adapterConfig: mergedAdapters[adapter],
      builtinModels,
      serviceModels: availableServiceModels,
      preferredServiceKey: defaultModelService,
      preserveUnknownDefaultModel: false
    })
    return compatibility.model ?? resolvedModel
  }, [
    adapterBuiltinModels,
    allBuiltinModelValues,
    availableServiceModels,
    defaultModel,
    defaultModelService,
    mergedAdapters
  ])

  const resolveCompatibleModelForAdapter = useCallback((adapter: string | undefined, model: string | undefined) => {
    if (!adapter || !model) return model

    const compatibility = resolveAdapterModelCompatibility({
      adapter,
      model,
      adapterConfig: mergedAdapters[adapter],
      builtinModels: buildBuiltinModelValues(adapterBuiltinModels[adapter]),
      serviceModels: availableServiceModels,
      preferredServiceKey: defaultModelService,
      preserveUnknownDefaultModel: false
    })

    return compatibility.model ?? model
  }, [
    adapterBuiltinModels,
    availableServiceModels,
    defaultModelService,
    mergedAdapters
  ])

  const resolveAdapterForModel = useCallback((model?: string) => {
    return resolveAdapterForChatModelSelection({
      model,
      availableAdapters,
      defaultAdapter,
      adapterBuiltinModels,
      modelMetadata: mergedModels
    })
  }, [adapterBuiltinModels, availableAdapters, defaultAdapter, mergedModels])

  const resolvedDefaultModel = useMemo(() => {
    return resolveDefaultChatModelSelection({
      defaultModel,
      defaultModelService,
      builtinModels: allBuiltinModelValues,
      serviceModels: availableServiceModels,
      preserveUnknownDefaultModel: false
    })
  }, [allBuiltinModelValues, availableServiceModels, defaultModel, defaultModelService])

  useEffect(() => {
    if (adapterLocked) return

    if (availableAdapters.length === 0) {
      setSelectedAdapter(undefined)
      if (!hasAvailableModels) setSelectedModel(undefined)
      return
    }

    if (!hasAvailableModels) {
      setSelectedModel(undefined)
      setSelectedAdapter((prev) => resolveAdapterValue(prev))
      return
    }

    if (selectionDriver === 'model') {
      const nextModelCandidate = resolveSelectableModel(selectedModel, allBuiltinModelValues, false) ??
        resolvedDefaultModel
      const nextAdapter = resolveAdapterForModel(nextModelCandidate) ?? resolveAdapterValue(selectedAdapter)
      const nextModel = resolveCompatibleModelForAdapter(nextAdapter, nextModelCandidate)
      setSelectedModel((prev) => prev === nextModel ? prev : nextModel)
      setSelectedAdapter((prev) => prev === nextAdapter ? prev : nextAdapter)
      return
    }

    const nextAdapter = resolveAdapterValue(selectedAdapter)
    const nextModel = resolveModelForAdapter(nextAdapter)
    setSelectedAdapter((prev) => prev === nextAdapter ? prev : nextAdapter)
    setSelectedModel((prev) => prev === nextModel ? prev : nextModel)
  }, [
    adapterLocked,
    allBuiltinModelValues,
    availableAdapters.length,
    hasAvailableModels,
    resolveAdapterForModel,
    resolveCompatibleModelForAdapter,
    resolveAdapterValue,
    resolveModelForAdapter,
    resolveSelectableModel,
    resolvedDefaultModel,
    selectedAdapter,
    selectedModel,
    selectionDriver
  ])

  useEffect(() => {
    try {
      if (selectedAdapter == null || selectedAdapter.trim() === '') {
        localStorage.removeItem(ADAPTER_STORAGE_KEY)
      } else {
        localStorage.setItem(ADAPTER_STORAGE_KEY, selectedAdapter)
      }
    } catch {}
  }, [selectedAdapter])

  useEffect(() => {
    try {
      if (selectedModel == null || selectedModel.trim() === '') {
        localStorage.removeItem(MODEL_STORAGE_KEY)
      } else {
        localStorage.setItem(MODEL_STORAGE_KEY, selectedModel)
      }
    } catch {}
  }, [selectedModel])

  useEffect(() => {
    try {
      localStorage.setItem(DRIVER_STORAGE_KEY, selectionDriver)
    } catch {}
  }, [selectionDriver])

  const updateSelectedModel = useCallback((value?: string) => {
    const builtinModels = adapterLocked
      ? buildBuiltinModelValues(selectedAdapter != null ? adapterBuiltinModels[selectedAdapter] : undefined)
      : allBuiltinModelValues
    const nextModel = resolveSelectableModel(value, builtinModels, false)
    if (!nextModel) return

    setSelectionDriver('model')
    const nextAdapter = adapterLocked
      ? selectedAdapter
      : (resolveAdapterForModel(nextModel) ?? resolveAdapterValue(selectedAdapter))
    const resolvedNextModel = resolveCompatibleModelForAdapter(nextAdapter, nextModel)
    setSelectedModel((prev) => prev === resolvedNextModel ? prev : resolvedNextModel)

    if (adapterLocked) return

    setSelectedAdapter((prev) => prev === nextAdapter ? prev : nextAdapter)
  }, [
    adapterBuiltinModels,
    adapterLocked,
    allBuiltinModelValues,
    resolveCompatibleModelForAdapter,
    resolveAdapterForModel,
    resolveAdapterValue,
    resolveSelectableModel,
    selectedAdapter
  ])

  const updateSelectedAdapter = useCallback((value?: string) => {
    const nextAdapter = resolveAdapterValue(value)
    setSelectionDriver('adapter')
    setSelectedAdapter((prev) => prev === nextAdapter ? prev : nextAdapter)

    if (adapterLocked) return

    const nextModel = resolveModelForAdapter(nextAdapter)
    setSelectedModel((prev) => prev === nextModel ? prev : nextModel)
  }, [adapterLocked, resolveAdapterValue, resolveModelForAdapter])

  const applySessionSelection = useCallback((params: { model?: string; adapter?: string }) => {
    const nextAdapter = normalizeNonEmptyString(params.adapter) ?? resolveAdapterValue(undefined)
    const sessionBuiltinModels = buildBuiltinModelValues(
      nextAdapter != null ? adapterBuiltinModels[nextAdapter] : undefined
    )
    const nextModel = resolveSelectableModel(params.model, sessionBuiltinModels, true) ??
      resolveSelectableModel(params.model, allBuiltinModelValues, true) ??
      normalizeNonEmptyString(params.model) ??
      resolveModelForAdapter(nextAdapter)

    setSelectedAdapter((prev) => prev === nextAdapter ? prev : nextAdapter)
    setSelectedModel((prev) => prev === nextModel ? prev : nextModel)
  }, [
    adapterBuiltinModels,
    allBuiltinModelValues,
    resolveAdapterValue,
    resolveModelForAdapter,
    resolveSelectableModel
  ])

  const selectedModelWithService = useMemo(() => (
    resolveSelectableModel(selectedModel, activeBuiltinModelValues, true) ?? selectedModel
  ), [activeBuiltinModelValues, resolveSelectableModel, selectedModel])

  const adapterOptions = useMemo<Array<{ value: string; label: ReactNode }>>(() => {
    return availableAdapters.map((key) => {
      const display = getAdapterDisplay(key)
      return {
        value: key,
        label: createElement('span', { className: 'adapter-option' }, [
          display.icon != null
            ? createElement('img', {
              key: 'icon',
              className: 'adapter-option__icon',
              src: display.icon,
              alt: '',
              'aria-hidden': true
            })
            : null,
          createElement('span', { key: 'text', className: 'adapter-option__text' }, display.title)
        ])
      }
    })
  }, [availableAdapters])

  const modelServiceEntries = useMemo(() => Object.entries(mergedModelServices), [mergedModelServices])
  const modelToService = useMemo(() => {
    const map = new Map<string, { key: string; title: string }>()
    for (const entry of availableServiceModels) {
      const serviceValue = mergedModelServices[entry.serviceKey]
      const serviceTitle = serviceValue?.title?.trim() !== '' ? serviceValue?.title ?? '' : entry.serviceKey
      if (!map.has(entry.model)) {
        map.set(entry.model, { key: entry.serviceKey, title: serviceTitle })
      }
    }
    return map
  }, [availableServiceModels, mergedModelServices])

  const modelOptions = useMemo<ModelSelectGroup[]>(() => {
    const buildOption = (params: {
      value: string
      title: string
      description?: string
      serviceKey?: string
      serviceTitle?: string
    }) => {
      const description = params.description?.trim()
      const label = (
        <div className='model-option'>
          <div className='model-option-title'>{params.title}</div>
          {description && <div className='model-option-desc'>{description}</div>}
        </div>
      )
      const searchText = [
        params.title,
        params.value,
        params.serviceTitle,
        params.serviceKey,
        description
      ]
        .filter(Boolean)
        .join(' ')
      return {
        value: params.value,
        label,
        searchText,
        displayLabel: params.title
      }
    }

    const resolveFirstAlias = (modelsAlias: Record<string, string[]> | undefined, model: string) => {
      if (!modelsAlias) return undefined
      for (const [alias, aliasModels] of Object.entries(modelsAlias)) {
        if (!Array.isArray(aliasModels)) continue
        if (aliasModels.includes(model)) return alias
      }
      return undefined
    }

    const serviceGroups = modelServiceEntries
      .map(([serviceKey, serviceValue]) => {
        const service = (serviceValue != null && typeof serviceValue === 'object')
          ? serviceValue as ModelServiceConfig
          : undefined
        const serviceTitle = service?.title?.trim() !== '' ? service?.title ?? '' : serviceKey
        const groupTitle = serviceTitle?.trim() !== '' ? serviceTitle : serviceKey
        const serviceDescription = service?.description
        const models = Array.isArray(service?.models)
          ? service.models.filter((item: unknown): item is string => typeof item === 'string')
          : []
        if (models.length === 0) return null
        const options = models.map((model: string) => {
          const alias = resolveFirstAlias(service?.modelsAlias as Record<string, string[]> | undefined, model)
          const title = alias ?? model
          const description = alias ? model : serviceTitle
          return buildOption({
            value: buildServiceModelSelector(serviceKey, model),
            title,
            description,
            serviceKey,
            serviceTitle
          })
        })
        return {
          label: (
            <div className='model-group-label'>
              <div className='model-group-title'>{groupTitle}</div>
              {serviceDescription && <div className='model-group-desc'>{serviceDescription}</div>}
            </div>
          ),
          options
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)

    const recommendedOptions = recommendedModels
      .filter((item) => {
        if (item.placement && item.placement !== 'modelSelector') return false
        return resolveServiceModelSelector({
          value: item.service ? buildServiceModelSelector(item.service, item.model) : item.model,
          serviceModels: availableServiceModels,
          preferredServiceKey: item.service ?? defaultModelService
        }) != null
      })
      .map((item) => {
        const serviceInfo = item.service ? mergedModelServices[item.service] : undefined
        const serviceTitle = item.service
          ? (serviceInfo?.title?.trim() !== '' ? serviceInfo?.title ?? '' : item.service)
          : modelToService.get(item.model)?.title
        const alias = item.service
          ? resolveFirstAlias(serviceInfo?.modelsAlias as Record<string, string[]> | undefined, item.model)
          : undefined
        const title = item.title?.trim() !== '' ? item.title ?? '' : (alias ?? item.model)
        const description = item.description?.trim() !== ''
          ? item.description
          : serviceTitle
        const value = resolveServiceModelSelector({
          value: item.service ? buildServiceModelSelector(item.service, item.model) : item.model,
          serviceModels: availableServiceModels,
          preferredServiceKey: item.service ?? defaultModelService
        }) ?? item.model
        return buildOption({
          value,
          title,
          description,
          serviceKey: item.service ?? modelToService.get(item.model)?.key,
          serviceTitle
        })
      })

    const groups = []
    if (recommendedOptions.length > 0) {
      const recommendedTitle = t('chat.modelGroupRecommended', { defaultValue: '推荐模型' })
      groups.push({
        label: (
          <div className='model-group-label'>
            <div className='model-group-title'>{recommendedTitle}</div>
          </div>
        ),
        options: recommendedOptions
      })
    }

    for (const [adapterKey, models] of Object.entries(activeBuiltinModels)) {
      if (!Array.isArray(models) || models.length === 0) continue
      const adapterTitle = t('chat.modelGroupBuiltin', {
        adapter: adapterKey,
        defaultValue: `${adapterKey} (Default)`
      })
      groups.push({
        label: (
          <div className='model-group-label'>
            <div className='model-group-title'>{adapterTitle}</div>
          </div>
        ),
        options: models.map(model =>
          buildOption({
            value: model.value,
            title: model.title,
            description: model.description
          })
        )
      })
    }

    return [...groups, ...serviceGroups]
  }, [
    activeBuiltinModels,
    availableServiceModels,
    defaultModelService,
    mergedModelServices,
    modelServiceEntries,
    modelToService,
    recommendedModels,
    t
  ])

  return {
    adapterOptions,
    applySessionSelection,
    hasAvailableModels,
    modelOptions,
    selectedAdapter,
    selectedModel,
    selectedModelWithService,
    setSelectedAdapter: updateSelectedAdapter,
    setSelectedModel: updateSelectedModel
  }
}
