import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'

import type { Config, ConfigSource } from '@vibe-forge/types'
import { resolveProjectConfigDir, resolveProjectWorkspaceFolder } from '@vibe-forge/utils'
import { dump, load } from 'js-yaml'

import { resetConfigCache } from './load'

export type { ConfigSource } from '@vibe-forge/types'

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

const PRIMARY_WORKSPACE_ENV = '__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__'

const resolvePrimaryWorkspaceFolder = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => {
  const normalizedWorkspaceFolder = resolve(cwd)
  const explicitPrimaryWorkspaceFolder = env[PRIMARY_WORKSPACE_ENV]?.trim()
  if (explicitPrimaryWorkspaceFolder) {
    const resolvedPrimaryWorkspaceFolder = resolve(explicitPrimaryWorkspaceFolder)
    return resolvedPrimaryWorkspaceFolder === normalizedWorkspaceFolder
      ? undefined
      : resolvedPrimaryWorkspaceFolder
  }

  try {
    const result = spawnSync('git', ['rev-parse', '--git-common-dir'], {
      cwd,
      encoding: 'utf8'
    })
    if (result.status !== 0) {
      return undefined
    }

    const gitCommonDir = result.stdout?.trim()
    if (!gitCommonDir) {
      return undefined
    }

    const primaryWorkspaceFolder = dirname(resolve(cwd, gitCommonDir))
    return primaryWorkspaceFolder === normalizedWorkspaceFolder
      ? undefined
      : primaryWorkspaceFolder
  } catch {
    return undefined
  }
}

const resolveWritableConfigPath = (
  workspaceFolder: string,
  source: ConfigSource,
  env: Record<string, string | null | undefined> = process.env
) => {
  const resolvedWorkspaceFolder = resolveProjectWorkspaceFolder(workspaceFolder, env)
  const configFolder = resolveProjectConfigDir(workspaceFolder, env) ?? resolvedWorkspaceFolder
  const paths = source === 'project' ? projectConfigPaths : userConfigPaths
  for (const path of paths) {
    const resolvedPath = resolve(configFolder, path)
    if (existsSync(resolvedPath)) {
      return resolvedPath
    }
  }

  if (source === 'user') {
    const primaryWorkspaceFolder = resolvePrimaryWorkspaceFolder(resolvedWorkspaceFolder, env)
    if (primaryWorkspaceFolder != null) {
      for (const path of paths) {
        const resolvedPath = resolve(primaryWorkspaceFolder, path)
        if (existsSync(resolvedPath)) {
          return resolvedPath
        }
      }
      return resolve(primaryWorkspaceFolder, paths[0])
    }
  }

  return resolve(configFolder, paths[0])
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

const hasOwn = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key)

const updateConfigSection = (config: Config, section: string, value: unknown): Config => {
  const nextConfig: Config = { ...config }
  const sectionValue = (value != null && typeof value === 'object')
    ? (value as Record<string, unknown>)
    : {}

  const updateField = <T extends keyof Config>(
    key: T,
    nextValue: Config[T] | undefined,
    shouldUpdate = true
  ) => {
    if (!shouldUpdate) {
      return
    }
    if (nextValue === undefined) {
      delete nextConfig[key]
    } else {
      nextConfig[key] = nextValue
    }
  }

  switch (section) {
    case 'general': {
      updateField('baseDir', sectionValue.baseDir as Config['baseDir'], hasOwn(sectionValue, 'baseDir'))
      updateField('effort', sectionValue.effort as Config['effort'], hasOwn(sectionValue, 'effort'))
      updateField(
        'defaultAdapter',
        sectionValue.defaultAdapter as Config['defaultAdapter'],
        hasOwn(sectionValue, 'defaultAdapter')
      )
      updateField(
        'defaultModelService',
        sectionValue.defaultModelService as Config['defaultModelService'],
        hasOwn(sectionValue, 'defaultModelService')
      )
      updateField(
        'defaultModel',
        sectionValue.defaultModel as Config['defaultModel'],
        hasOwn(sectionValue, 'defaultModel')
      )
      updateField(
        'recommendedModels',
        sectionValue.recommendedModels as Config['recommendedModels'],
        hasOwn(sectionValue, 'recommendedModels')
      )
      updateField(
        'interfaceLanguage',
        sectionValue.interfaceLanguage as Config['interfaceLanguage'],
        hasOwn(sectionValue, 'interfaceLanguage')
      )
      updateField(
        'modelLanguage',
        sectionValue.modelLanguage as Config['modelLanguage'],
        hasOwn(sectionValue, 'modelLanguage')
      )
      updateField(
        'announcements',
        sectionValue.announcements as Config['announcements'],
        hasOwn(sectionValue, 'announcements')
      )
      updateField(
        'permissions',
        mergeMaskedValues(sectionValue.permissions, config.permissions) as Config['permissions'],
        hasOwn(sectionValue, 'permissions')
      )
      updateField(
        'env',
        mergeMaskedValues(sectionValue.env, config.env) as Config['env'],
        hasOwn(sectionValue, 'env')
      )
      updateField(
        'notifications',
        mergeMaskedValues(sectionValue.notifications, config.notifications) as Config['notifications'],
        hasOwn(sectionValue, 'notifications')
      )
      updateField(
        'webAuth',
        mergeMaskedValues(sectionValue.webAuth, config.webAuth) as Config['webAuth'],
        hasOwn(sectionValue, 'webAuth')
      )
      updateField(
        'shortcuts',
        mergeMaskedValues(sectionValue.shortcuts, config.shortcuts) as Config['shortcuts'],
        hasOwn(sectionValue, 'shortcuts')
      )
      return nextConfig
    }
    case 'conversation': {
      updateField('conversation', mergeMaskedValues(sectionValue, config.conversation) as Config['conversation'])
      return nextConfig
    }
    case 'auth': {
      updateField('webAuth', mergeMaskedValues(sectionValue, config.webAuth) as Config['webAuth'])
      return nextConfig
    }
    case 'models': {
      updateField(
        'models',
        mergeMaskedValues(sectionValue, config.models) as Config['models']
      )
      return nextConfig
    }
    case 'modelServices': {
      updateField(
        'modelServices',
        mergeMaskedValues(sectionValue, config.modelServices) as Config['modelServices']
      )
      return nextConfig
    }
    case 'channels': {
      updateField(
        'channels',
        mergeMaskedValues(sectionValue, config.channels) as Config['channels']
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
        'marketplaces',
        sectionValue.marketplaces as Config['marketplaces'],
        hasOwn(sectionValue, 'marketplaces')
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
  const configPath = resolveWritableConfigPath(workspaceFolder, options.source)
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
