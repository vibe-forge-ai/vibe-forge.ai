import type { ModelServiceConfig } from '@vibe-forge/core'

import { asPlainRecord, normalizeStringRecord } from './object-utils'

const normalizePositiveInteger = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined
)

const appendQueryParams = (baseURL: string, queryParams: Record<string, string>) => {
  if (Object.keys(queryParams).length === 0) return baseURL

  const url = new URL(baseURL)
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

const normalizeProviderBaseURL = (baseURL: string, npmPackage: string) => {
  if (npmPackage === '@ai-sdk/openai-compatible') return baseURL.replace(/\/chat\/completions\/?$/u, '')
  if (npmPackage === '@ai-sdk/openai') return baseURL.replace(/\/responses\/?$/u, '')
  return baseURL
}

const getProviderExtra = (service: ModelServiceConfig) => ({
  ...asPlainRecord(asPlainRecord(service.extra)?.codex),
  ...asPlainRecord(asPlainRecord(service.extra)?.opencode)
})

const inferProviderPackage = (service: ModelServiceConfig, providerExtra: Record<string, unknown>) => {
  if (typeof providerExtra.npm === 'string' && providerExtra.npm.trim() !== '') return providerExtra.npm
  const wireApi = typeof providerExtra.wireApi === 'string' ? providerExtra.wireApi : undefined
  return wireApi === 'responses' || service.apiBaseUrl.includes('/responses')
    ? '@ai-sdk/openai'
    : '@ai-sdk/openai-compatible'
}

export const resolveOpenCodeModel = (
  rawModel: string | undefined,
  modelServices: Record<string, ModelServiceConfig>
) => {
  const normalized = rawModel?.trim()
  if (normalized == null || normalized === '' || normalized.toLowerCase() === 'default') {
    return { cliModel: undefined, providerConfig: undefined }
  }

  if (!normalized.includes(',')) {
    return { cliModel: normalized, providerConfig: undefined }
  }

  const commaIndex = normalized.indexOf(',')
  const serviceKey = normalized.slice(0, commaIndex).trim()
  const modelId = normalized.slice(commaIndex + 1).trim()
  const service = modelServices[serviceKey]

  if (!service || modelId === '') {
    return {
      cliModel: serviceKey !== '' && modelId !== '' ? `${serviceKey}/${modelId}` : (modelId || normalized),
      providerConfig: undefined
    }
  }

  const providerExtra = getProviderExtra(service)
  const providerId = typeof providerExtra.providerId === 'string' && providerExtra.providerId.trim() !== ''
    ? providerExtra.providerId
    : serviceKey
  const npm = inferProviderPackage(service, providerExtra)
  const baseURL = appendQueryParams(
    normalizeProviderBaseURL(service.apiBaseUrl, npm),
    normalizeStringRecord(providerExtra.queryParams)
  )
  const normalizedTimeoutMs = normalizePositiveInteger(service.timeoutMs)
  const normalizedMaxOutputTokens = normalizePositiveInteger(service.maxOutputTokens)

  return {
    cliModel: `${providerId}/${modelId}`,
    providerConfig: {
      [providerId]: {
        npm,
        name: service.title?.trim() !== '' ? service.title : serviceKey,
        options: {
          apiKey: service.apiKey,
          baseURL,
          ...(normalizedTimeoutMs != null
            ? {
              timeout: normalizedTimeoutMs,
              chunkTimeout: normalizedTimeoutMs
            }
            : {}),
          ...(() => {
            const headers = normalizeStringRecord(providerExtra.headers)
            return Object.keys(headers).length > 0 ? { headers } : {}
          })()
        },
        models: {
          [modelId]: {
            name: modelId,
            ...(normalizedMaxOutputTokens != null
              ? {
                limit: {
                  output: normalizedMaxOutputTokens
                },
                options: {
                  maxOutputTokens: normalizedMaxOutputTokens
                }
              }
              : {})
          }
        }
      }
    }
  }
}
