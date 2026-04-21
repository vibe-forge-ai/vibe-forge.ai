import { buildConfigSections } from '@vibe-forge/config'
import type { AdapterBuiltinModel, Config } from '@vibe-forge/types'

import { getServerAppInfo } from '#~/utils/app-info.js'

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => sanitize(item))
  }
  if (value != null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = sanitize(val)
      return acc
    }, {})
  }
  return value
}

export const buildSections = (config: Config | undefined) => {
  const sections = sanitize(buildConfigSections(config)) as ReturnType<typeof buildConfigSections>

  return {
    ...sections,
    adapterBuiltinModels: {} as Record<string, AdapterBuiltinModel[]>
  }
}

export const loadAdapterBuiltinModels = (
  adapters: Config['adapters']
): Record<string, AdapterBuiltinModel[]> => {
  const result: Record<string, AdapterBuiltinModel[]> = {}
  if (!adapters) return result
  for (const adapterKey of Object.keys(adapters)) {
    try {
      const packageName = adapterKey.startsWith('@') ? adapterKey : `@vibe-forge/adapter-${adapterKey}`
      // eslint-disable-next-line ts/no-require-imports
      const mod = require(`${packageName}/models`)
      if (Array.isArray(mod?.builtinModels)) {
        result[adapterKey] = mod.builtinModels
      }
    } catch {
      // Adapter does not export builtin models, skip.
    }
  }
  return result
}

export const buildConfigAbout = async () => {
  const appInfo = await getServerAppInfo()
  return {
    version: appInfo.version,
    lastReleaseAt: appInfo.lastReleaseAt,
    urls: {
      repo: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
      docs: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
      contact: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
      issues: 'https://github.com/vibe-forge-ai/vibe-forge.ai/issues',
      releases: 'https://github.com/vibe-forge-ai/vibe-forge.ai/releases'
    }
  }
}
