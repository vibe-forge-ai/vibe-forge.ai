import type { ChannelConfig } from '../channel'
import type { PluginConfig } from '../hooks'

export interface AdapterMap {}

export interface AdapterConfigCommon {
  /**
   * 适配器默认模型
   */
  defaultModel?: string
  /**
   * 允许的模型选择器列表。
   * - `service`
   * - `service,model`
   * - builtin / raw model
   */
  includeModels?: string[]
  /**
   * 禁止的模型选择器列表。
   * - `service`
   * - `service,model`
   * - builtin / raw model
   */
  excludeModels?: string[]
}

export type AdapterConfigEntry<T> = T & AdapterConfigCommon

export type AdapterConfigMap = Partial<{
  [K in keyof AdapterMap]: AdapterConfigEntry<AdapterMap[K]>
}>

export interface AdapterBuiltinModel {
  value: string
  title: string
  description: string
}

export interface ModelServiceConfig {
  /**
   * 模型服务展示标题
   */
  title?: string
  /**
   * 模型服务展示描述
   */
  description?: string
  /**
   * 模型服务 API 基础 URL
   */
  apiBaseUrl: string
  /**
   * 模型服务 API 密钥
   */
  apiKey: string
  /**
   * 模型服务支持的模型列表
   */
  models?: string[]
  /**
   * 模型服务支持的模型别名
   */
  modelsAlias?: Record<string, string[]>
  /**
   * 模型服务超时（毫秒）。
   * - Codex: 映射为 `stream_idle_timeout_ms`
   * - Claude Code Router: 映射为全局 `API_TIMEOUT_MS`
   * - OpenCode: 映射为 provider `timeout` / `chunkTimeout`
   */
  timeoutMs?: number
  /**
   * 模型服务默认最大输出 token。
   * - Codex: 对 routed model service 通过本地代理写入 Responses API `max_output_tokens`
   * - Claude Code Router: 映射为 `maxtoken` transformer
   * - OpenCode: 映射为 model `options.maxOutputTokens` / `limit.output`
   */
  maxOutputTokens?: number
  /**
   * 拓展配置，由下游自行消费
   */
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
  /**
   * 配置目录
   */
  baseDir?: string
  /**
   * 适配器配置
   */
  adapters?: AdapterConfigMap
  /**
   * 模型选择器元信息
   */
  models?: Record<string, ModelMetadataConfig>
  /**
   * 默认适配器名称
   */
  defaultAdapter?: keyof AdapterMap
  /**
   * 模型服务配置
   */
  modelServices?: Record<string, ModelServiceConfig>
  /**
   * 频道配置
   */
  channels?: Record<string, ChannelConfig>
  /**
   * 默认模型服务名称
   */
  defaultModelService?: string
  /**
   * 默认模型名称
   */
  defaultModel?: string
  recommendedModels?: RecommendedModelConfig[]
  interfaceLanguage?: LanguageCode
  modelLanguage?: LanguageCode
  /**
   * MCP 服务器配置
   */
  mcpServers?: Record<
    string,
    & {
      /**
       * 是否启用
       */
      enabled?: boolean
      /**
       * 环境变量配置
       */
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
  /**
   * 默认启用的 MCP 服务器列表
   */
  defaultIncludeMcpServers?: string[]
  /**
   * 默认禁用的 MCP 服务器列表
   */
  defaultExcludeMcpServers?: string[]
  noDefaultVibeForgeMcpServer?: boolean
  /**
   * 权限配置
   */
  permissions?: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
    defaultMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  }
  /**
   * 环境变量配置
   */
  env?: Record<string, string>
  /**
   * 公告配置
   */
  announcements?: string[]
  /**
   * 快捷键配置
   */
  shortcuts?: {
    newSession?: string
    openConfig?: string
  }
  notifications?: NotificationConfig
  /**
   * 会话配置
   */
  conversation?: {
    /**
     * 对话风格
     * - `friendly`: 友好的对话风格，适合用户与助手交互
     * - `programmatic`: 程序化的对话风格，适合助手执行任务
     */
    style?: 'friendly' | 'programmatic'
    /**
     * 自定义对话风格。通过指定提示词约束对话风格。
     */
    customInstructions?: string
    /**
     * 是否注入 Vibe Forge 自动生成的默认系统提示词
     * （例如 rules / skills / entities / specs 生成的提示词）。
     * 默认为 true。
     */
    injectDefaultSystemPrompt?: boolean
  }
  /**
   * 插件配置
   */
  plugins?: PluginConfig
  enabledPlugins?: Record<string, boolean>
  extraKnownMarketplaces?: Record<
    string,
    {
      source:
        | {
          source: 'github'
          repo: string
        }
        | {
          source: 'git'
          url: string
        }
        | {
          source: 'directory'
          path: string
        }
    }
  >
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
    enabledPlugins?: Config['enabledPlugins']
    extraKnownMarketplaces?: Config['extraKnownMarketplaces']
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

export const defineConfig = (config: Config) => config
