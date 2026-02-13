import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'

import { dump, load } from 'js-yaml'

import type { Config } from '../../config'
import { resetConfigCache } from '../../config'

export type ConfigSource = 'project' | 'user'

export interface UpdateConfigFileOptions {
  workspaceFolder?: string
  source: ConfigSource
  section: string
  value: unknown
}

const shouldMaskKey = (key: string) => /key|token|secret|password/i.test(key)

const projectConfigPaths = [
  './.ai.config.json',
  './infra/.ai.config.json',
  './.ai.config.yaml',
  './.ai.config.yml',
  './infra/.ai.config.yaml',
  './infra/.ai.config.yml'
]

const userConfigPaths = [
  './.ai.dev.config.json',
  './infra/.ai.dev.config.json',
  './.ai.dev.config.yaml',
  './.ai.dev.config.yml',
  './infra/.ai.dev.config.yaml',
  './infra/.ai.dev.config.yml'
]

const resolveConfigPath = (workspaceFolder: string, source: ConfigSource) => {
  const paths = source === 'project' ? projectConfigPaths : userConfigPaths
  for (const path of paths) {
    const resolved = resolve(workspaceFolder, path)
    if (existsSync(resolved)) {
      return resolved
    }
  }
  return resolve(workspaceFolder, paths[0])
}

const parseConfigContent = (format: string, content: string) => {
  if (format === '.yaml' || format === '.yml') {
    return (load(content) ?? {}) as Record<string, unknown>
  }
  return JSON.parse(content) as Record<string, unknown>
}

const serializeConfigContent = (format: string, value: Record<string, unknown>) => {
  if (format === '.yaml' || format === '.yml') {
    return `${dump(value, { noRefs: true, lineWidth: 120 })}\n`
  }
  return `${JSON.stringify(value, null, 2)}\n`
}

const mergeMaskedValues = (incoming: unknown, existing: unknown): unknown => {
  if (Array.isArray(incoming)) return incoming
  if (incoming != null && typeof incoming === 'object') {
    const incomingRecord = incoming as Record<string, unknown>
    const existingRecord = (existing != null && typeof existing === 'object')
      ? (existing as Record<string, unknown>)
      : {}
    return Object.entries(incomingRecord).reduce<Record<string, unknown>>((acc, [key, val]) => {
      if (shouldMaskKey(key) && val === '******') {
        acc[key] = existingRecord[key]
      } else {
        acc[key] = mergeMaskedValues(val, existingRecord[key])
      }
      return acc
    }, {})
  }
  return incoming
}

const updateConfigSection = (config: Config, section: string, value: unknown): Config => {
  const nextConfig: Config = { ...config }
  const sectionValue = (value != null && typeof value === 'object')
    ? (value as Record<string, unknown>)
    : {}

  const updateField = <T extends keyof Config>(key: T, nextValue: Config[T] | undefined) => {
    if (nextValue === undefined) {
      delete nextConfig[key]
    } else {
      nextConfig[key] = nextValue
    }
  }

  switch (section) {
    case 'general': {
      updateField('baseDir', sectionValue.baseDir as Config['baseDir'])
      updateField('defaultAdapter', sectionValue.defaultAdapter as Config['defaultAdapter'])
      updateField('defaultModelService', sectionValue.defaultModelService as Config['defaultModelService'])
      updateField('defaultModel', sectionValue.defaultModel as Config['defaultModel'])
      updateField('interfaceLanguage', sectionValue.interfaceLanguage as Config['interfaceLanguage'])
      updateField('modelLanguage', sectionValue.modelLanguage as Config['modelLanguage'])
      updateField('announcements', sectionValue.announcements as Config['announcements'])
      updateField(
        'permissions',
        mergeMaskedValues(sectionValue.permissions, config.permissions) as Config['permissions']
      )
      updateField(
        'env',
        mergeMaskedValues(sectionValue.env, config.env) as Config['env']
      )
      updateField(
        'notifications',
        mergeMaskedValues(sectionValue.notifications, config.notifications) as Config['notifications']
      )
      updateField(
        'shortcuts',
        mergeMaskedValues(sectionValue.shortcuts, config.shortcuts) as Config['shortcuts']
      )
      return nextConfig
    }
    case 'conversation': {
      updateField('conversation', mergeMaskedValues(sectionValue, config.conversation) as Config['conversation'])
      return nextConfig
    }
    case 'modelServices': {
      updateField(
        'modelServices',
        mergeMaskedValues(sectionValue, config.modelServices) as Config['modelServices']
      )
      return nextConfig
    }
    case 'adapters': {
      updateField('adapters', mergeMaskedValues(sectionValue, config.adapters) as Config['adapters'])
      return nextConfig
    }
    case 'plugins': {
      updateField('plugins', sectionValue.plugins as Config['plugins'])
      updateField(
        'enabledPlugins',
        mergeMaskedValues(sectionValue.enabledPlugins, config.enabledPlugins) as Config['enabledPlugins']
      )
      updateField(
        'extraKnownMarketplaces',
        mergeMaskedValues(
          sectionValue.extraKnownMarketplaces,
          config.extraKnownMarketplaces
        ) as Config['extraKnownMarketplaces']
      )
      return nextConfig
    }
    case 'mcp': {
      updateField(
        'mcpServers',
        mergeMaskedValues(sectionValue.mcpServers, config.mcpServers) as Config['mcpServers']
      )
      updateField(
        'defaultIncludeMcpServers',
        sectionValue.defaultIncludeMcpServers as Config['defaultIncludeMcpServers']
      )
      updateField(
        'defaultExcludeMcpServers',
        sectionValue.defaultExcludeMcpServers as Config['defaultExcludeMcpServers']
      )
      updateField(
        'noDefaultVibeForgeMcpServer',
        sectionValue.noDefaultVibeForgeMcpServer as Config['noDefaultVibeForgeMcpServer']
      )
      return nextConfig
    }
    case 'shortcuts': {
      updateField(
        'shortcuts',
        mergeMaskedValues(sectionValue, config.shortcuts) as Config['shortcuts']
      )
      return nextConfig
    }
    default:
      return nextConfig
  }
}

export const updateConfigFile = async (options: UpdateConfigFileOptions) => {
  const workspaceFolder = options.workspaceFolder ?? process.cwd()
  const configPath = resolveConfigPath(workspaceFolder, options.source)
  const format = extname(configPath).toLowerCase()
  const hasExisting = existsSync(configPath)
  const existingContent = hasExisting ? await readFile(configPath, 'utf-8') : ''
  const existingConfig = hasExisting ? parseConfigContent(format, existingContent) : {}
  const updatedConfig = updateConfigSection(existingConfig as Config, options.section, options.value)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(
    configPath,
    serializeConfigContent(format, updatedConfig as Record<string, unknown>),
    'utf-8'
  )
  resetConfigCache()
  return { configPath, updatedConfig }
}

export const configController = {
  updateConfigFile
}
