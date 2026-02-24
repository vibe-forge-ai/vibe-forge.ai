import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { ConfigResponse, ModelServiceConfig, RecommendedModelConfig } from '@vibe-forge/core'
import { getConfig } from '../../api'

interface ModelSelectOption {
  value: string
  label: React.ReactNode
  searchText: string
}

interface ModelSelectGroup {
  label: React.ReactNode
  options: ModelSelectOption[]
}

export function useChatModels() {
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

  const recommendedModels = useMemo(() => {
    const raw = configRes?.sources?.merged?.general?.recommendedModels
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is RecommendedModelConfig => (
      item != null && typeof item === 'object' && typeof item.model === 'string' && item.model.trim() !== ''
    ))
  }, [configRes?.sources?.merged?.general?.recommendedModels])

  const modelServiceEntries = useMemo(() => Object.entries(mergedModelServices), [mergedModelServices])

  const availableModels = useMemo(() => {
    const list: Array<{ model: string; serviceKey: string; serviceTitle: string }> = []
    for (const [serviceKey, serviceValue] of modelServiceEntries) {
      const service = (serviceValue != null && typeof serviceValue === 'object') ? serviceValue as ModelServiceConfig : undefined
      const serviceTitle = service?.title?.trim() !== '' ? service?.title ?? '' : serviceKey
      const models = Array.isArray(service?.models) ? service?.models.filter(item => typeof item === 'string') : []
      for (const model of models) {
        list.push({ model, serviceKey, serviceTitle })
      }
    }
    return list
  }, [modelServiceEntries])

  const availableModelValues = useMemo(() => availableModels.map(item => item.model), [availableModels])
  const availableModelKey = useMemo(() => availableModelValues.join('|'), [availableModelValues])
  const availableModelSet = useMemo(() => new Set(availableModelValues), [availableModelKey])
  const hasAvailableModels = availableModelValues.length > 0
  const defaultModelService = configRes?.sources?.merged?.general?.defaultModelService
  const defaultModel = configRes?.sources?.merged?.general?.defaultModel
  const resolvedDefaultModel = useMemo(() => {
    if (!hasAvailableModels) return undefined
    if (defaultModel && availableModelSet.has(defaultModel)) return defaultModel
    if (defaultModelService && mergedModelServices[defaultModelService]) {
      const service = mergedModelServices[defaultModelService]
      const models = Array.isArray(service?.models) ? service?.models.filter(item => typeof item === 'string') : []
      if (models.length > 0) return models[0]
    }
    return availableModelValues[0]
  }, [availableModelSet, availableModelValues, defaultModel, defaultModelService, hasAvailableModels, mergedModelServices])

  useEffect(() => {
    if (!hasAvailableModels) {
      setSelectedModel(undefined)
      return
    }
    setSelectedModel((prev) => {
      if (prev != null && availableModelSet.has(prev)) return prev
      return resolvedDefaultModel
    })
  }, [availableModelSet, hasAvailableModels, resolvedDefaultModel])

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
        searchText
      }
    }

    const modelToService = new Map<string, { key: string; title: string }>()
    for (const entry of availableModels) {
      if (!modelToService.has(entry.model)) {
        modelToService.set(entry.model, { key: entry.serviceKey, title: entry.serviceTitle })
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
        const service = (serviceValue != null && typeof serviceValue === 'object') ? serviceValue as ModelServiceConfig : undefined
        const serviceTitle = service?.title?.trim() !== '' ? service?.title ?? '' : serviceKey
        const groupTitle = serviceTitle?.trim() !== '' ? serviceTitle : serviceKey
        const serviceDescription = service?.description
        const models = Array.isArray(service?.models) ? service?.models.filter(item => typeof item === 'string') : []
        if (models.length === 0) return null
        const options = models.map((model) => {
          const alias = resolveFirstAlias(service?.modelsAlias as Record<string, string[]> | undefined, model)
          const title = alias ?? model
          const description = alias ? model : serviceTitle
          return buildOption({
            value: model,
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
        return availableModelSet.has(item.model)
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
        return buildOption({
          value: item.model,
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
    return [...groups, ...serviceGroups]
  }, [availableModelSet, availableModels, mergedModelServices, modelServiceEntries, recommendedModels, t])

  return {
    selectedModel,
    setSelectedModel,
    modelOptions,
    hasAvailableModels
  }
}
