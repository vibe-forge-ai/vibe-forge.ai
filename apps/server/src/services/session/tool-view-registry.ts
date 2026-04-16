import type { ToolPresentationInput, ToolPresentationProvider } from '@vibe-forge/types'
import { loadAdapterPresentationProviders } from '@vibe-forge/types'
import { buildGenericToolView } from '@vibe-forge/tool-view'

const providerCache = new Map<string, ToolPresentationProvider[]>()

const genericProvider: ToolPresentationProvider = {
  matches: () => true,
  build: input => buildGenericToolView(input)
}

export const resolveToolPresentationProviders = (params: {
  adapterInstanceId?: string
}) => {
  const adapterInstanceId = params.adapterInstanceId?.trim()
  if (adapterInstanceId == null || adapterInstanceId === '') {
    return [genericProvider]
  }

  const cached = providerCache.get(adapterInstanceId)
  if (cached != null) {
    return [...cached, genericProvider]
  }

  const loaded = loadAdapterPresentationProviders(adapterInstanceId)
  providerCache.set(adapterInstanceId, loaded)
  return [...loaded, genericProvider]
}

export const buildToolViewEnvelope = (
  input: ToolPresentationInput,
  params: {
    adapterInstanceId?: string
  } = {}
) => {
  for (const provider of resolveToolPresentationProviders(params)) {
    if (!provider.matches(input)) {
      continue
    }

    const view = provider.build(input)
    if (view != null) {
      return view
    }
  }

  return undefined
}
