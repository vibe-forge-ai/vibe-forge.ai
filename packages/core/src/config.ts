import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

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

const loadJSONConfig = async (paths: string[], jsonVariables: Record<string, string | undefined>) => {
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

export const loadConfig = async (options: {
  jsonVariables?: Record<string, string | undefined>
}) =>
  [
    await loadJSConfig([
      './.ai.config.js',
      './infra/.ai.config.js',
      './.ai.config.mjs',
      './infra/.ai.config.mjs',
      './.ai.config.cjs',
      './infra/.ai.config.cjs',
      './.ai.config.ts',
      './infra/.ai.config.ts',
      './.ai.config.mts',
      './infra/.ai.config.mts',
      './.ai.config.cts',
      './infra/.ai.config.cts'
    ]) ??
      await loadJSONConfig(
        [
          './.ai.config.json',
          './infra/.ai.config.json'
        ],
        options.jsonVariables ?? {}
      ),
    await loadJSConfig([
      './.ai.config.js',
      './infra/.ai.config.js',
      './.ai.config.mjs',
      './infra/.ai.config.mjs',
      './.ai.config.cjs',
      './infra/.ai.config.cjs',
      './.ai.dev.config.ts',
      './infra/.ai.dev.config.ts',
      './.ai.dev.config.mts',
      './infra/.ai.dev.config.mts',
      './.ai.dev.config.cts',
      './infra/.ai.dev.config.cts'
    ]) ??
      await loadJSONConfig(
        [
          './.ai.dev.config.json',
          './infra/.ai.dev.config.json'
        ],
        options.jsonVariables ?? {}
      )
  ] as const

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
