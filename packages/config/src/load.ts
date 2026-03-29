import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { load } from 'js-yaml'

export interface LoadConfigOptions {
  cwd?: string
  jsonVariables?: Record<string, string | null | undefined>
  disableDevConfig?: boolean
}

const serializeJsonVariables = (value: Record<string, string | null | undefined>) => (
  JSON.stringify(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
  )
)

const resolveConfigCacheKey = (options: LoadConfigOptions) => {
  const cwd = options.cwd ?? process.cwd()
  const disableDevConfig = options.disableDevConfig === true ? '1' : '0'
  const jsonVariables = serializeJsonVariables(options.jsonVariables ?? {})
  return `${cwd}\n${disableDevConfig}\n${jsonVariables}`
}

const resolveConfigPath = (cwd: string, filePath: string) => resolve(cwd, filePath)

export const buildConfigJsonVariables = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => ({
  ...env,
  WORKSPACE_FOLDER: cwd,
  __VF_PROJECT_WORKSPACE_FOLDER__: cwd
})

const loadJSConfig = async <TConfig>(
  cwd: string,
  paths: string[]
) => {
  for (const path of paths) {
    try {
      const configPath = resolveConfigPath(cwd, path)
      if (!existsSync(configPath)) {
        continue
      }
      // eslint-disable-next-line ts/no-require-imports
      return (require(configPath)?.default ?? {}) as TConfig
    } catch (e) {
      console.error(`Failed to load config file ${path}: ${e}`)
    }
  }
}

const loadJSONConfig = async <TConfig>(
  cwd: string,
  paths: string[],
  jsonVariables: Record<string, string | null | undefined>
) => {
  for (const path of paths) {
    try {
      const configPath = resolveConfigPath(cwd, path)
      if (!existsSync(configPath)) {
        continue
      }
      const configContent = await readFile(configPath, 'utf-8')
      const configResolvedContent = configContent
        .replace(/\$\{(\w+)\}/g, (_, key) => jsonVariables[key] ?? `$\{${key}}`)
      return JSON.parse(configResolvedContent) as TConfig
    } catch (e) {
      console.error(`Failed to load config file ${path}: ${e}`)
    }
  }
}

const loadYAMLConfig = async <TConfig>(
  cwd: string,
  paths: string[],
  jsonVariables: Record<string, string | null | undefined>
) => {
  for (const path of paths) {
    try {
      const configPath = resolveConfigPath(cwd, path)
      if (!existsSync(configPath)) {
        continue
      }
      const configContent = await readFile(configPath, 'utf-8')
      const configResolvedContent = configContent
        .replace(/\$\{(\w+)\}/g, (_, key) => jsonVariables[key] ?? `$\{${key}}`)
      return load(configResolvedContent) as TConfig
    } catch (e) {
      console.error(`Failed to load config file ${path}: ${e}`)
    }
  }
}

const configCache = new Map<string, Promise<readonly [unknown | undefined, unknown | undefined]>>()
export const DISABLE_DEV_CONFIG_ENV = '__VF_PROJECT_AI_DISABLE_DEV_CONFIG__'

export const resetConfigCache = (cwd?: string) => {
  if (cwd == null) {
    configCache.clear()
    return
  }

  for (const key of configCache.keys()) {
    if (key.startsWith(`${cwd}\n`)) {
      configCache.delete(key)
    }
  }
}

export const loadConfig = <TConfig = Record<string, unknown>>(
  options: LoadConfigOptions = {}
) => {
  const cacheKey = resolveConfigCacheKey(options)
  const cachedConfig = configCache.get(cacheKey)
  if (cachedConfig != null) {
    return cachedConfig as Promise<readonly [TConfig | undefined, TConfig | undefined]>
  }

  const cwd = options.cwd ?? process.cwd()
  const shouldLoadDevConfig = (
    options.disableDevConfig !== true &&
    process.env[DISABLE_DEV_CONFIG_ENV] !== '1'
  )

  const nextConfig = (async () =>
    [
      await loadJSONConfig<TConfig>(
        cwd,
        [
          './.ai.config.json',
          './infra/.ai.config.json'
        ],
        options.jsonVariables ?? {}
      ) ??
        await loadYAMLConfig<TConfig>(
          cwd,
          [
            './.ai.config.yaml',
            './.ai.config.yml',
            './infra/.ai.config.yaml',
            './infra/.ai.config.yml'
          ],
          options.jsonVariables ?? {}
        ),
      shouldLoadDevConfig
        ? await loadJSONConfig<TConfig>(
          cwd,
          [
            './.ai.dev.config.json',
            './infra/.ai.dev.config.json'
          ],
          options.jsonVariables ?? {}
        ) ??
          await loadYAMLConfig<TConfig>(
            cwd,
            [
              './.ai.dev.config.yaml',
              './.ai.dev.config.yml',
              './infra/.ai.dev.config.yaml',
              './infra/.ai.dev.config.yml'
            ],
            options.jsonVariables ?? {}
          )
        : undefined
    ] as const)()
  configCache.set(cacheKey, nextConfig)
  return nextConfig
}

export const loadAdapterConfig = async <TAdapterConfig = unknown>(
  name: string,
  options: LoadConfigOptions = {}
) => {
  const [projectConfig, userConfig] = await loadConfig<{
    adapters?: Record<string, TAdapterConfig>
  }>(options)
  return {
    ...(projectConfig?.adapters?.[name] ?? {}),
    ...(userConfig?.adapters?.[name] ?? {})
  } as TAdapterConfig
}
