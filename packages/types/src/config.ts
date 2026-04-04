import type { EffortLevel } from './common'
import type { PluginConfig } from './plugin'

export interface AdapterMap {}

export interface AdapterConfigCommon {
  defaultModel?: string
  includeModels?: string[]
  excludeModels?: string[]
}

export type AdapterConfigEntry<T> = T & AdapterConfigCommon

export type AdapterConfigMap = Partial<
  {
    [K in keyof AdapterMap]: AdapterConfigEntry<AdapterMap[K]>
  }
>

export interface AdapterBuiltinModel {
  value: string
  title: string
  description: string
}

export interface ModelServiceConfig {
  title?: string
  description?: string
  apiBaseUrl: string
  apiKey: string
  models?: string[]
  modelsAlias?: Record<string, string[]>
  timeoutMs?: number
  maxOutputTokens?: number
  extra?: Record<string, unknown>
}

export interface RecommendedModelConfig {
  service?: string
  model: string
  title?: string
  description?: string
  placement?: 'modelSelector'
}

export interface ModelMetadataConfig {
  defaultAdapter?: string
  effort?: EffortLevel
}

export type LanguageCode = 'zh' | 'en'

export type NotificationTrigger = 'completed' | 'failed' | 'terminated' | 'waiting_input'

export interface NotificationEventConfig {
  title?: string
  description?: string
  disabled?: boolean
  sound?: string
}

export interface NotificationConfig {
  disabled?: boolean
  volume?: number
  events?: Partial<Record<NotificationTrigger, NotificationEventConfig>>
}

export interface Config {
  extend?: string | string[]
  baseDir?: string
  effort?: EffortLevel
  adapters?: AdapterConfigMap
  models?: Record<string, ModelMetadataConfig>
  defaultAdapter?: keyof AdapterMap
  modelServices?: Record<string, ModelServiceConfig>
  channels?: Record<string, unknown>
  defaultModelService?: string
  defaultModel?: string
  recommendedModels?: RecommendedModelConfig[]
  interfaceLanguage?: LanguageCode
  modelLanguage?: LanguageCode
  mcpServers?: Record<
    string,
    & {
      enabled?: boolean
      env?: Record<string, string>
    }
    & (
      | {
        type?: undefined
        command: string
        args: string[]
      }
      | {
        type: 'sse'
        url: string
        headers: Record<string, string>
      }
      | {
        type: 'http'
        url: string
        headers?: Record<string, string>
      }
    )
  >
  defaultIncludeMcpServers?: string[]
  defaultExcludeMcpServers?: string[]
  noDefaultVibeForgeMcpServer?: boolean
  permissions?: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
    defaultMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  }
  env?: Record<string, string>
  announcements?: string[]
  shortcuts?: {
    newSession?: string
    openConfig?: string
    sendMessage?: string
    clearInput?: string
    switchModel?: string
    switchEffort?: string
    switchPermissionMode?: string
  }
  notifications?: NotificationConfig
  conversation?: {
    style?: 'friendly' | 'programmatic'
    customInstructions?: string
    injectDefaultSystemPrompt?: boolean
  }
  /**
   * 当前 workspace 默认启用的插件实例列表。
   *
   * 插件包需要先安装到当前项目中，运行时不会自动安装缺失依赖。
   *
   * @example
   * ```json
   * [
   *   { "id": "standard-dev", "scope": "std" },
   *   { "id": "logger", "enabled": false }
   * ]
   * ```
   */
  plugins?: PluginConfig
}

export interface AboutInfo {
  version?: string
  lastReleaseAt?: string
  urls?: {
    repo?: string
    docs?: string
    contact?: string
    issues?: string
    releases?: string
  }
}

export interface ConfigSection {
  general?: {
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
  }
  conversation?: Config['conversation']
  models?: Config['models']
  modelServices?: Config['modelServices']
  channels?: Config['channels']
  adapters?: Config['adapters']
  adapterBuiltinModels?: Record<string, AdapterBuiltinModel[]>
  plugins?: {
    plugins?: Config['plugins']
  }
  mcp?: {
    mcpServers?: Config['mcpServers']
    defaultIncludeMcpServers?: Config['defaultIncludeMcpServers']
    defaultExcludeMcpServers?: Config['defaultExcludeMcpServers']
    noDefaultVibeForgeMcpServer?: Config['noDefaultVibeForgeMcpServer']
  }
  shortcuts?: Config['shortcuts']
}

export interface ConfigResponse {
  sources?: {
    project?: ConfigSection
    user?: ConfigSection
    merged?: ConfigSection
  }
  meta?: {
    workspaceFolder?: string
    configPresent?: {
      project?: boolean
      user?: boolean
    }
    experiments?: Record<string, unknown>
    about?: AboutInfo
  }
}
