import { CONFIG_SECTION_KEYS, hasConfigSectionValue } from '@vibe-forge/config'
import type { ConfigSectionKey, ConfigSections } from '@vibe-forge/config'

import { CONFIG_READ_SOURCES } from './shared'
import type { ConfigListSource, LoadedConfigCommandState } from './shared'

export const resolveListOutput = (
  state: LoadedConfigCommandState,
  source: ConfigListSource
) => {
  if (source !== 'all') {
    return Object.fromEntries(
      CONFIG_SECTION_KEYS.map(section => [
        section,
        hasConfigSectionValue(state.sections[source][section])
      ])
    )
  }

  const sources = source === 'all' ? CONFIG_READ_SOURCES : [source]

  return Object.fromEntries(
    CONFIG_SECTION_KEYS.map((section) => [
      section,
      Object.fromEntries(
        sources.map(currentSource => [
          currentSource,
          hasConfigSectionValue(state.sections[currentSource][section])
        ])
      )
    ])
  )
}

export const resolveTextListRows = (
  state: LoadedConfigCommandState,
  source: ConfigListSource
) => {
  if (source !== 'all') {
    return CONFIG_SECTION_KEYS.map((section) => ({
      Section: section,
      Present: hasConfigSectionValue(state.sections[source][section]) ? 'yes' : ''
    }))
  }

  const sources = source === 'all' ? CONFIG_READ_SOURCES : [source]

  return CONFIG_SECTION_KEYS.map((section) => (
    Object.fromEntries([
      ['Section', section],
      ...sources.map(currentSource => [
        currentSource[0]!.toUpperCase() + currentSource.slice(1),
        hasConfigSectionValue(state.sections[currentSource][section]) ? 'yes' : ''
      ])
    ])
  ))
}

export const resolveClearedSectionValue = (section: ConfigSectionKey): ConfigSections[ConfigSectionKey] => {
  switch (section) {
    case 'general':
      return {
        baseDir: undefined,
        effort: undefined,
        defaultAdapter: undefined,
        defaultModelService: undefined,
        defaultModel: undefined,
        recommendedModels: undefined,
        interfaceLanguage: undefined,
        modelLanguage: undefined,
        announcements: undefined,
        permissions: undefined,
        env: undefined,
        notifications: undefined,
        shortcuts: undefined
      }
    case 'plugins':
      return {
        plugins: undefined,
        marketplaces: undefined
      }
    case 'mcp':
      return {
        mcpServers: undefined,
        defaultIncludeMcpServers: undefined,
        defaultExcludeMcpServers: undefined,
        noDefaultVibeForgeMcpServer: undefined
      }
    case 'mdp':
      return {}
    case 'conversation':
    case 'models':
    case 'modelServices':
    case 'channels':
    case 'adapters':
    case 'shortcuts':
      return {}
  }
}
