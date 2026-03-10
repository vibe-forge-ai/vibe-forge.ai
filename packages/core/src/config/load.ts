import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { load } from 'js-yaml'

import type { AdapterMap, Config } from './types'

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

export const resetConfigCache = () => {
  configCache = null
}

export const loadConfig = (options: {
  jsonVariables?: Record<string, string | null | undefined>
}) => {
  if (configCache) {
    return configCache
  }

  configCache = (async () =>
    [
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
    ] as const)()
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

