import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type {
  AdapterBuiltinModel,
  ConfigResponse,
  ModelMetadataConfig,
  ModelServiceConfig,
  RecommendedModelConfig
} from '@vibe-forge/types'

import { getConfig } from '#~/api.js'
import {
  buildServiceModelSelector,
  listServiceModels,
  resolveChatModelSelection,
  resolveDefaultChatModelSelection,
  resolveModelDisplayMetadata,
  resolveModelServiceTitle,
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

export function useChatModels({
  selectedAdapter
}: {
  selectedAdapter?: string
} = {}) {
  const { t } = useTranslation()
  const [selectedModel, setSelectedModel] = useState<string | undefined>(() => {
    try {
      const raw = localStorage.getItem('vf_chat_selected_model')
      return raw == null || raw.trim() === '' ? undefined : raw
    } catch {
      return undefined
    }
  })
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)

  const mergedModelServices = useMemo(() => {
    const services = configRes?.sources?.merged?.modelServices
    return (services ?? {}) as Record<string, ModelServiceConfig>
  }, [configRes?.sources?.merged?.modelServices])

  const mergedModels = useMemo(() => {
    const models = configRes?.sources?.merged?.models
    return (models ?? {}) as Record<string, ModelMetadataConfig>
  }, [configRes?.sources?.merged?.models])

  const recommendedModels = useMemo(() => {
    const raw = configRes?.sources?.merged?.general?.recommendedModels
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is RecommendedModelConfig => (
      item != null && typeof item === 'object' && typeof item.model === 'string' && item.model.trim() !== ''
    ))
  }, [configRes?.sources?.merged?.general?.recommendedModels])

  const adapterBuiltinModels = useMemo(() => {
    const raw = configRes?.sources?.merged?.adapterBuiltinModels
    return (raw ?? {}) as Record<string, AdapterBuiltinModel[]>
  }, [configRes?.sources?.merged?.adapterBuiltinModels])

  const activeBuiltinModels = useMemo(() => {
    if (selectedAdapter && adapterBuiltinModels[selectedAdapter]) {
      return { [selectedAdapter]: adapterBuiltinModels[selectedAdapter] }
    }
    return adapterBuiltinModels
  }, [adapterBuiltinModels, selectedAdapter])

  const activeBuiltinModelValues = useMemo(() => (
    Object.values(activeBuiltinModels).flat().map(model => model.value)
  ), [activeBuiltinModels])

  const builtinModelSet = useMemo(() => {
    const set = new Set<string>()
    for (const models of Object.values(activeBuiltinModels)) {
      for (const m of models) set.add(m.value)
    }
    return set
  }, [activeBuiltinModels])

  const modelServiceEntries = useMemo(() => Object.entries(mergedModelServices), [mergedModelServices])

  const availableServiceModels = useMemo(() => listServiceModels(mergedModelServices), [mergedModelServices])
  const hasAvailableModels = availableServiceModels.length > 0 || builtinModelSet.size > 0
  const modelToService = useMemo(() => {
    const map = new Map<string, { key: string; title: string }>()
    for (const entry of availableServiceModels) {
      const serviceValue = mergedModelServices[entry.serviceKey]
      const serviceTitle = resolveModelServiceTitle({
        serviceKey: entry.serviceKey,
        service: serviceValue
      })
      if (!map.has(entry.model)) {
        map.set(entry.model, { key: entry.serviceKey, title: serviceTitle })
      }
    }
    return map
  }, [availableServiceModels, mergedModelServices])
  const defaultModelService = configRes?.sources?.merged?.general?.defaultModelService
  const defaultModel = configRes?.sources?.merged?.general?.defaultModel
  const formatModelWithService = useCallback((model: string | undefined) => {
    return resolveChatModelSelection({
      value: model,
      builtinModels: activeBuiltinModelValues,
      serviceModels: availableServiceModels,
      defaultModelService
    })
  }, [activeBuiltinModelValues, availableServiceModels, defaultModelService])
  const resolvedDefaultModel = useMemo(() => {
    return resolveDefaultChatModelSelection({
      defaultModel,
      defaultModelService,
      builtinModels: activeBuiltinModelValues,
      serviceModels: availableServiceModels
    })
  }, [
    activeBuiltinModelValues,
    availableServiceModels,
    defaultModel,
    defaultModelService
  ])
  const selectedModelWithService = useMemo(() => (
    formatModelWithService(selectedModel) ?? resolvedDefaultModel
  ), [formatModelWithService, resolvedDefaultModel, selectedModel])

  const resolveSelectableModel = useCallback((value?: string) => {
    return resolveChatModelSelection({
      value,
      builtinModels: activeBuiltinModelValues,
      serviceModels: availableServiceModels,
      defaultModelService
    }) ?? resolvedDefaultModel
  }, [activeBuiltinModelValues, availableServiceModels, defaultModelService, resolvedDefaultModel])

  const updateSelectedModel = useCallback((value?: string) => {
    setSelectedModel((prev) => {
      const nextValue = resolveSelectableModel(value)
      return nextValue === prev ? prev : nextValue
    })
  }, [resolveSelectableModel])

  useEffect(() => {
    if (!hasAvailableModels) {
      setSelectedModel(undefined)
      return
    }
    setSelectedModel((prev) => resolveSelectableModel(prev))
  }, [hasAvailableModels, resolveSelectableModel, selectedAdapter])

  useEffect(() => {
    try {
      if (selectedModel == null || selectedModel.trim() === '') {
        localStorage.removeItem('vf_chat_selected_model')
      } else {
        localStorage.setItem('vf_chat_selected_model', selectedModel)
      }
    } catch {
    }
  }, [selectedModel])

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

    const serviceGroups = modelServiceEntries
      .map(([serviceKey, serviceValue]) => {
        const service = (serviceValue != null && typeof serviceValue === 'object')
          ? serviceValue as ModelServiceConfig
          : undefined
        const serviceTitle = resolveModelServiceTitle({
          serviceKey,
          service
        })
        const groupTitle = serviceTitle?.trim() !== '' ? serviceTitle : serviceKey
        const serviceDescription = service?.description
        const models = Array.isArray(service?.models)
          ? service.models.filter((item: unknown): item is string => typeof item === 'string')
          : []
        if (models.length === 0) return null
        const options = models.map((model: string) => {
          const value = buildServiceModelSelector(serviceKey, model)
          const metadata = resolveModelDisplayMetadata({
            model: value,
            models: mergedModels
          })
          const title = metadata?.title ?? metadata?.aliases[0] ?? model
          const description = metadata?.description ?? serviceTitle
          return buildOption({
            value,
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
          ? resolveModelServiceTitle({
            serviceKey: item.service,
            service: serviceInfo
          })
          : modelToService.get(item.model)?.title
        const resolvedModel = item.service ? buildServiceModelSelector(item.service, item.model) : item.model
        const metadata = resolveModelDisplayMetadata({
          model: resolvedModel,
          models: mergedModels
        })
        const title = item.title?.trim() !== ''
          ? item.title ?? ''
          : (metadata?.title ?? metadata?.aliases[0] ?? item.model)
        const description = item.description?.trim() !== ''
          ? item.description
          : (metadata?.description ?? serviceTitle)
        const value = resolveServiceModelSelector({
          value: resolvedModel,
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

    // Adapter builtin model groups (filtered to active adapter)
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
        options: models.map(m =>
          buildOption({
            value: m.value,
            title: m.title,
            description: m.description
          })
        )
      })
    }

    return [...groups, ...serviceGroups]
  }, [
    activeBuiltinModels,
    availableServiceModels,
    defaultModelService,
    modelToService,
    mergedModels,
    mergedModelServices,
    modelServiceEntries,
    recommendedModels,
    t
  ])

  return {
    selectedModel,
    selectedModelWithService,
    setSelectedModel: updateSelectedModel,
    modelOptions,
    hasAvailableModels
  }
}
