import React, { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type {
  AdapterBuiltinModel,
  ConfigResponse,
  ModelMetadataConfig,
  ModelServiceConfig,
  RecommendedModelConfig
} from '@vibe-forge/types'

import { getConfig, updateConfig } from '#~/api.js'
import { ModelSelectOptionLabel } from '#~/components/chat/sender/@components/model-select/ModelSelectOptionLabel'
import { getAdapterDisplay } from '#~/resources/adapters.js'
import {
  listServiceModels,
  normalizeNonEmptyString,
  resolveAdapterForChatModelSelection,
  resolveAdapterModelCompatibility,
  resolveChatAdapterSelection,
  resolveChatModelSelection,
  resolveDefaultChatModelSelection,
  resolveModelForChatAdapterSelection
} from './model-selector'
import { buildModelSelectorData } from './model-selector-data'
import type { ModelSelectGroupData, ModelSelectOptionData } from './model-selector-data'
import {
  buildRecommendedModelKey,
  buildUpdatedUserGeneralSection,
  isModelSelectorRecommendation,
  toggleModelSelectorRecommendation
} from './model-selector-recommendations'

export interface ModelSelectOption extends ModelSelectOptionData {
  canToggleRecommendation: boolean
  isRecommended: boolean
  isUserRecommended: boolean
  label: React.ReactNode
}

export interface ModelSelectGroup {
  key: string
  label: React.ReactNode
  options: ModelSelectOption[]
}

export interface ModelSelectMenuGroup extends Omit<ModelSelectGroupData, 'options'> {
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
  const [updatingRecommendedModelValue, setUpdatingRecommendedModelValue] = useState<string | undefined>()
  const { data: configRes, mutate } = useSWR<ConfigResponse>('/api/config', getConfig)

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

  const userRecommendedModels = useMemo(() => {
    const raw = configRes?.sources?.user?.general?.recommendedModels
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is RecommendedModelConfig => (
      item != null && typeof item === 'object' && typeof item.model === 'string' && item.model.trim() !== ''
    ))
  }, [configRes?.sources?.user?.general?.recommendedModels])

  const userRecommendedModelKeySet = useMemo(() => {
    return new Set(
      userRecommendedModels
        .filter(isModelSelectorRecommendation)
        .map(item =>
          buildRecommendedModelKey({
            model: item.model,
            service: item.service
          })
        )
    )
  }, [userRecommendedModels])

  const mergedRecommendedModelKeySet = useMemo(() => {
    return new Set(
      recommendedModels
        .filter(isModelSelectorRecommendation)
        .map(item =>
          buildRecommendedModelKey({
            model: item.model,
            service: item.service
          })
        )
    )
  }, [recommendedModels])

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

  const toggleRecommendedModel = useCallback(async (option: ModelSelectOption) => {
    const serviceKey = option.serviceKey?.trim()
    const modelName = option.modelName.trim()
    if (
      configRes?.sources == null ||
      !serviceKey ||
      modelName === '' ||
      updatingRecommendedModelValue === option.value
    ) {
      return
    }

    setUpdatingRecommendedModelValue(option.value)

    try {
      const { recommendedModels: nextRecommendedModels } = toggleModelSelectorRecommendation({
        currentRecommendedModels: configRes?.sources?.user?.general?.recommendedModels,
        nextRecommendedModel: {
          service: serviceKey,
          model: modelName,
          placement: 'modelSelector'
        }
      })
      const nextUserGeneralSection = buildUpdatedUserGeneralSection({
        currentGeneral: configRes?.sources?.user?.general,
        recommendedModels: nextRecommendedModels
      })

      await updateConfig('user', 'general', nextUserGeneralSection)
      await mutate()
    } catch (error) {
      console.error('[chat] failed to update recommended models', error)
    } finally {
      setUpdatingRecommendedModelValue(undefined)
    }
  }, [configRes?.sources?.user?.general, mutate, updatingRecommendedModelValue])

  const decorateModelOption = useCallback((option: ModelSelectOptionData): ModelSelectOption => {
    const recommendationKey = option.serviceKey == null
      ? undefined
      : buildRecommendedModelKey({
        model: option.modelName,
        service: option.serviceKey
      })
    const decoratedOption: ModelSelectOption = {
      ...option,
      canToggleRecommendation: option.serviceKey != null && option.modelName.trim() !== '',
      isRecommended: recommendationKey != null && mergedRecommendedModelKeySet.has(recommendationKey),
      isUserRecommended: recommendationKey != null && userRecommendedModelKeySet.has(recommendationKey),
      label: null
    }

    decoratedOption.label = (
      <ModelSelectOptionLabel
        option={decoratedOption}
        onToggleRecommendedModel={toggleRecommendedModel}
        updatingRecommendedModelValue={updatingRecommendedModelValue}
      />
    )

    return decoratedOption
  }, [mergedRecommendedModelKeySet, toggleRecommendedModel, updatingRecommendedModelValue, userRecommendedModelKeySet])

  const modelSelectorData = useMemo(() => {
    return buildModelSelectorData({
      activeBuiltinModels,
      availableServiceModels,
      defaultModelService,
      mergedModels,
      mergedModelServices,
      recommendedModels,
      recommendedGroupTitle: t('chat.modelGroupRecommended', { defaultValue: '推荐模型' }),
      servicePreviewGroupTitle: t('chat.modelGroupServices', { defaultValue: '模型服务' }),
      builtinGroupTitle: (adapterKey) =>
        t('chat.modelGroupBuiltin', {
          adapter: adapterKey,
          defaultValue: `${adapterKey} (Default)`
        })
    })
  }, [
    activeBuiltinModels,
    availableServiceModels,
    defaultModelService,
    mergedModels,
    mergedModelServices,
    recommendedModels,
    t
  ])

  const modelSearchOptions = useMemo<ModelSelectOption[]>(() => {
    return modelSelectorData.searchOptions.map(decorateModelOption)
  }, [decorateModelOption, modelSelectorData.searchOptions])

  const recommendedModelOptions = useMemo<ModelSelectOption[]>(() => {
    return modelSelectorData.recommendedOptions.map(decorateModelOption)
  }, [decorateModelOption, modelSelectorData.recommendedOptions])

  const servicePreviewModelOptions = useMemo<ModelSelectOption[]>(() => {
    return modelSelectorData.servicePreviewOptions.map(decorateModelOption)
  }, [decorateModelOption, modelSelectorData.servicePreviewOptions])

  const modelMenuGroups = useMemo<ModelSelectMenuGroup[]>(() => {
    return modelSelectorData.moreModelGroups.map(group => ({
      ...group,
      options: group.options.map(decorateModelOption)
    }))
  }, [decorateModelOption, modelSelectorData.moreModelGroups])

  const modelOptions = useMemo<ModelSelectGroup[]>(() => {
    return modelSelectorData.flatGroups.map(group => ({
      key: group.key,
      label: (
        <div className='model-group-label'>
          <div className='model-group-title'>{group.title}</div>
          {group.description && <div className='model-group-desc'>{group.description}</div>}
        </div>
      ),
      options: group.options.map(decorateModelOption)
    }))
  }, [decorateModelOption, modelSelectorData.flatGroups])

  return {
    adapterOptions,
    applySessionSelection,
    hasAvailableModels,
    modelMenuGroups,
    modelOptions,
    modelSearchOptions,
    recommendedModelOptions,
    servicePreviewModelOptions,
    selectedAdapter,
    selectedModel,
    selectedModelWithService,
    setSelectedAdapter: updateSelectedAdapter,
    setSelectedModel: updateSelectedModel,
    toggleRecommendedModel,
    updatingRecommendedModelValue
  }
}
