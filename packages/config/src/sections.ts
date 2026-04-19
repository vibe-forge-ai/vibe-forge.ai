import type { Config } from '@vibe-forge/types'

export const CONFIG_SECTION_KEYS = [
  'general',
  'conversation',
  'models',
  'modelServices',
  'workspaces',
  'channels',
  'adapters',
  'plugins',
  'mcp',
  'auth',
  'shortcuts'
] as const

export type ConfigSectionKey = typeof CONFIG_SECTION_KEYS[number]

export interface ConfigSections {
  general: {
    baseDir?: Config['baseDir']
    effort?: Config['effort']
    defaultAdapter?: Config['defaultAdapter']
    defaultModelService?: Config['defaultModelService']
    defaultModel?: Config['defaultModel']
    recommendedModels?: Config['recommendedModels']
    interfaceLanguage?: Config['interfaceLanguage']
    modelLanguage?: Config['modelLanguage']
    announcements?: Config['announcements']
    permissions?: Config['permissions']
    env?: Config['env']
    notifications?: Config['notifications']
    webAuth?: Config['webAuth']
    shortcuts?: Config['shortcuts']
  }
  conversation: Config['conversation']
  models: Config['models']
  modelServices: Config['modelServices']
  workspaces: Config['workspaces']
  channels: Config['channels']
  adapters: Config['adapters']
  plugins: {
    plugins?: Config['plugins']
    marketplaces?: Config['marketplaces']
  }
  mcp: {
    mcpServers?: Config['mcpServers']
    defaultIncludeMcpServers?: Config['defaultIncludeMcpServers']
    defaultExcludeMcpServers?: Config['defaultExcludeMcpServers']
    noDefaultVibeForgeMcpServer?: Config['noDefaultVibeForgeMcpServer']
  }
  auth: Config['webAuth']
  shortcuts: Config['shortcuts']
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

export const buildConfigSections = (config: Config | undefined): ConfigSections => ({
  general: {
    baseDir: config?.baseDir,
    effort: config?.effort,
    defaultAdapter: config?.defaultAdapter,
    defaultModelService: config?.defaultModelService,
    defaultModel: config?.defaultModel,
    recommendedModels: config?.recommendedModels,
    interfaceLanguage: config?.interfaceLanguage,
    modelLanguage: config?.modelLanguage,
    announcements: config?.announcements,
    permissions: config?.permissions,
    env: config?.env,
    notifications: config?.notifications,
    webAuth: config?.webAuth,
    shortcuts: config?.shortcuts
  },
  conversation: config?.conversation,
  models: config?.models,
  modelServices: config?.modelServices,
  workspaces: config?.workspaces,
  channels: config?.channels,
  adapters: config?.adapters,
  plugins: {
    plugins: config?.plugins,
    marketplaces: config?.marketplaces
  },
  mcp: {
    mcpServers: config?.mcpServers,
    defaultIncludeMcpServers: config?.defaultIncludeMcpServers,
    defaultExcludeMcpServers: config?.defaultExcludeMcpServers,
    noDefaultVibeForgeMcpServer: config?.noDefaultVibeForgeMcpServer
  },
  auth: config?.webAuth,
  shortcuts: config?.shortcuts
})

export const hasConfigSectionValue = (value: unknown): boolean => {
  if (value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (isRecord(value)) {
    return Object.values(value).some(item => hasConfigSectionValue(item))
  }

  return true
}
