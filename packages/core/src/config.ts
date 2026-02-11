import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { load } from 'js-yaml'

import type { PluginConfig } from './hooks'

export interface AdapterMap {}

export interface ModelServiceConfig {
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
   * 拓展配置，由下游自行消费
   */
  extra?: Record<string, unknown>
}

export interface Config {
  /**
   * 配置目录
   */
  baseDir?: string
  /**
   * 适配器配置
   */
  adapters?: Partial<AdapterMap>
  /**
   * 默认适配器名称
   */
  defaultAdapter?: keyof AdapterMap
  /**
   * 模型服务配置
   */
  modelServices?: Record<string, ModelServiceConfig>
  /**
   * 默认模型服务名称
   */
  defaultModelService?: string
  /**
   * 默认模型名称
   */
  defaultModel?: string
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

export const defineConfig = (config: Config) => config

const loadJSConfig = async (paths: string[]) => {
  for (const path of paths) {
    try {
      const configPath = resolve(process.cwd(), path)
      if (!existsSync(configPath)) {
        continue
      }
      // eslint-disable-next-line ts/no-require-imports
      return (require(configPath)?.default ?? {}) as Config
    } catch (e) {
      console.error(`Failed to load config file ${path}: ${e}`)
    }
  }
}

const loadJSONConfig = async (paths: string[], jsonVariables: Record<string, string | null | undefined>) => {
  for (const path of paths) {
    try {
      const configPath = resolve(process.cwd(), path)
      if (!existsSync(configPath)) {
        continue
      }
      const configContent = await readFile(configPath, 'utf-8')
      const configResolvedContent = configContent
        .replace(/\$\{(\w+)\}/g, (_, key) => jsonVariables[key] ?? `$\{${key}}`)
      return JSON.parse(configResolvedContent) as Config
    } catch (e) {
      console.error(`Failed to load config file ${path}: ${e}`)
    }
  }
}

const loadYAMLConfig = async (paths: string[], jsonVariables: Record<string, string | null | undefined>) => {
  for (const path of paths) {
    try {
      const configPath = resolve(process.cwd(), path)
      if (!existsSync(configPath)) {
        continue
      }
      const configContent = await readFile(configPath, 'utf-8')
      const configResolvedContent = configContent
        .replace(/\$\{(\w+)\}/g, (_, key) => jsonVariables[key] ?? `$\{${key}}`)
      return load(configResolvedContent) as Config
    } catch (e) {
      console.error(`Failed to load config file ${path}: ${e}`)
    }
  }
}

let configCache: Promise<readonly [Config | undefined, Config | undefined]> | null = null

export const loadConfig = (options: {
  jsonVariables?: Record<string, string | null | undefined>
}) => {
  if (configCache) {
    return configCache
  }

  configCache = (async () => {
    return [
      await loadJSONConfig(
        [
          './.ai.config.json',
          './infra/.ai.config.json'
        ],
        options.jsonVariables ?? {}
      ) ??
        await loadYAMLConfig(
          [
            './.ai.config.yaml',
            './.ai.config.yml',
            './infra/.ai.config.yaml',
            './infra/.ai.config.yml'
          ],
          options.jsonVariables ?? {}
        ),
      await loadJSONConfig(
        [
          './.ai.dev.config.json',
          './infra/.ai.dev.config.json'
        ],
        options.jsonVariables ?? {}
      ) ??
        await loadYAMLConfig(
          [
            './.ai.dev.config.yaml',
            './.ai.dev.config.yml',
            './infra/.ai.dev.config.yaml',
            './infra/.ai.dev.config.yml'
          ],
          options.jsonVariables ?? {}
        )
    ] as const
  })()
  return configCache
}

export const loadAdapterConfig = async <
  K extends keyof AdapterMap,
>(
  name: K,
  options: { jsonVariables?: Record<string, string> }
) => {
  const [projectConfig, userConfig] = await loadConfig(options)
  return {
    ...(projectConfig?.adapters?.[name] ?? {}),
    ...(userConfig?.adapters?.[name] ?? {})
  } as unknown as NonNullable<Config['adapters']>[K]
}
