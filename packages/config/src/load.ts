import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'

import type { Config } from '@vibe-forge/types'
import { load } from 'js-yaml'

import { mergeConfigs } from './merge'

export interface LoadConfigOptions {
  cwd?: string
  jsonVariables?: Record<string, string | null | undefined>
  disableDevConfig?: boolean
}

interface ConfigWithExtend {
  extend?: string | string[]
}

const CONFIG_FILE_EXTENSIONS = new Set([
  '.json',
  '.yaml',
  '.yml'
])

const PACKAGE_DEFAULT_CONFIG_FILES = [
  '.ai.config.json',
  '.ai.config.yaml',
  '.ai.config.yml'
]

const PRIMARY_WORKSPACE_ENV = '__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__'

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

const isExistingFilePath = (filePath: string) => {
  if (!existsSync(filePath)) return false

  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

const replaceJsonVariables = (
  content: string,
  jsonVariables: Record<string, string | null | undefined>
) => (
  content.replace(/\$\{(\w+)\}/g, (_, key) => jsonVariables[key] ?? `$\{${key}}`)
)

export const buildConfigJsonVariables = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => ({
  ...env,
  WORKSPACE_FOLDER: cwd,
  __VF_PROJECT_WORKSPACE_FOLDER__: cwd
})

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

const toExtendPaths = (value: unknown) => {
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim()]
  }

  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(item => item.trim())
}

const omitExtendField = (value: Config) => {
  const { extend: _extend, ...rest } = value as Config & ConfigWithExtend
  return rest as Config
}

const resolveExtendCandidates = (configPath: string, extendPath: string) => {
  const resolvedPath = resolve(dirname(configPath), extendPath)
  if (extname(resolvedPath) !== '') return [resolvedPath]

  return [
    resolvedPath,
    `${resolvedPath}.json`,
    `${resolvedPath}.yaml`,
    `${resolvedPath}.yml`
  ]
}

const parsePackageSpecifier = (specifier: string) => {
  if (
    specifier.trim() === '' ||
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    /^[a-z]:[\\/]/i.test(specifier)
  ) {
    return undefined
  }

  const segments = specifier.split('/')
  if (segments.length === 0) return undefined

  if (specifier.startsWith('@')) {
    const [scope, name, ...rest] = segments
    if (!scope || !name) return undefined

    return {
      packageName: `${scope}/${name}`,
      subpath: rest.length > 0 ? rest.join('/') : undefined
    }
  }

  const [name, ...rest] = segments
  if (!name) return undefined

  return {
    packageName: name,
    subpath: rest.length > 0 ? rest.join('/') : undefined
  }
}

const resolveConfigCandidatesFromBasePath = (basePath: string) => (
  extname(basePath) !== ''
    ? [basePath]
    : [
      basePath,
      `${basePath}.json`,
      `${basePath}.yaml`,
      `${basePath}.yml`
    ]
)

const resolveDependencyExtendPath = (configPath: string, extendPath: string) => {
  const resolver = createRequire(configPath)

  try {
    const directResolvedPath = resolver.resolve(extendPath)
    if (
      isExistingFilePath(directResolvedPath) &&
      CONFIG_FILE_EXTENSIONS.has(extname(directResolvedPath).toLowerCase())
    ) {
      return directResolvedPath
    }
  } catch {}

  const parsed = parsePackageSpecifier(extendPath)
  if (parsed == null) return undefined

  try {
    const packageJsonPath = resolver.resolve(`${parsed.packageName}/package.json`)
    const packageRoot = dirname(packageJsonPath)

    if (parsed.subpath == null) {
      return PACKAGE_DEFAULT_CONFIG_FILES
        .map(fileName => resolve(packageRoot, fileName))
        .find(candidate => isExistingFilePath(candidate))
    }

    return resolveConfigCandidatesFromBasePath(resolve(packageRoot, parsed.subpath))
      .find(candidate => isExistingFilePath(candidate))
  } catch {
    return undefined
  }
}

const resolveExistingExtendPath = (configPath: string, extendPath: string) => (
  resolveExtendCandidates(configPath, extendPath)
    .find(candidate => isExistingFilePath(candidate)) ??
    resolveDependencyExtendPath(configPath, extendPath)
)

const readConfigFile = async (
  configPath: string,
  jsonVariables: Record<string, string | null | undefined>
) => {
  const configContent = await readFile(configPath, 'utf-8')
  const configResolvedContent = replaceJsonVariables(configContent, jsonVariables)
  const extension = extname(configPath).toLowerCase()

  if (extension === '.json') {
    return JSON.parse(configResolvedContent) as unknown
  }

  if (extension === '.yaml' || extension === '.yml') {
    return load(configResolvedContent) as unknown
  }

  throw new Error(`Unsupported config file extension "${extension || '<none>'}"`)
}

const loadResolvedConfigFile = async (
  configPath: string,
  jsonVariables: Record<string, string | null | undefined>,
  loadingStack: Set<string>
): Promise<Config> => {
  if (loadingStack.has(configPath)) {
    throw new Error(`Circular config extend detected: ${
      [
        ...loadingStack,
        configPath
      ].join(' -> ')
    }`)
  }

  const rawConfig = await readConfigFile(
    configPath,
    jsonVariables
  ) as Config & ConfigWithExtend

  if (!isRecord(rawConfig)) {
    throw new Error(`Config file "${configPath}" must resolve to an object`)
  }

  const nextLoadingStack = new Set(loadingStack)
  nextLoadingStack.add(configPath)

  let mergedExtendedConfig: Config | undefined
  for (const extendPath of toExtendPaths(rawConfig.extend)) {
    const extendedConfigPath = resolveExistingExtendPath(configPath, extendPath)
    if (extendedConfigPath == null) {
      throw new Error(`Extended config "${extendPath}" not found from "${configPath}"`)
    }

    const extendedConfig = await loadResolvedConfigFile(
      extendedConfigPath,
      jsonVariables,
      nextLoadingStack
    )
    mergedExtendedConfig = mergeConfigs(mergedExtendedConfig, extendedConfig)
  }

  return mergeConfigs(
    mergedExtendedConfig,
    omitExtendField(rawConfig)
  ) ?? omitExtendField(rawConfig)
}

const loadConfigFromPaths = async (
  cwd: string,
  paths: string[],
  jsonVariables: Record<string, string | null | undefined>
) => {
  for (const path of paths) {
    try {
      const configPath = resolveConfigPath(cwd, path)
      if (!isExistingFilePath(configPath)) {
        continue
      }

      return await loadResolvedConfigFile(
        configPath,
        jsonVariables,
        new Set()
      )
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

export const loadConfig = (options: LoadConfigOptions = {}) => {
  const cacheKey = resolveConfigCacheKey(options)
  const cachedConfig = configCache.get(cacheKey)
  if (cachedConfig != null) {
    return cachedConfig as Promise<readonly [Config | undefined, Config | undefined]>
  }

  const cwd = options.cwd ?? process.cwd()
  const shouldLoadDevConfig = options.disableDevConfig !== true &&
    process.env[DISABLE_DEV_CONFIG_ENV] !== '1'
  const jsonVariables = options.jsonVariables ?? {}

  const nextConfig = (async () => {
    const projectConfig = await loadConfigFromPaths(
      cwd,
      [
        './.ai.config.json',
        './infra/.ai.config.json',
        './.ai.config.yaml',
        './.ai.config.yml',
        './infra/.ai.config.yaml',
        './infra/.ai.config.yml'
      ],
      jsonVariables
    )

    let userConfig: Config | undefined
    if (shouldLoadDevConfig) {
      userConfig = await loadConfigFromPaths(
        cwd,
        [
          './.ai.dev.config.json',
          './infra/.ai.dev.config.json',
          './.ai.dev.config.yaml',
          './.ai.dev.config.yml',
          './infra/.ai.dev.config.yaml',
          './infra/.ai.dev.config.yml'
        ],
        jsonVariables
      )
      if (userConfig == null) {
        const primaryWorkspaceFolder = resolvePrimaryWorkspaceFolder(cwd)
        if (primaryWorkspaceFolder != null) {
          userConfig = await loadConfigFromPaths(
            primaryWorkspaceFolder,
            [
              './.ai.dev.config.json',
              './infra/.ai.dev.config.json',
              './.ai.dev.config.yaml',
              './.ai.dev.config.yml',
              './infra/.ai.dev.config.yaml',
              './infra/.ai.dev.config.yml'
            ],
            jsonVariables
          )
        }
      }
    }

    return [
      projectConfig,
      userConfig
    ] as const
  })()
  configCache.set(cacheKey, nextConfig)
  return nextConfig
}

export const loadAdapterConfig = async (
  name: string,
  options: LoadConfigOptions = {}
) => {
  const [projectConfig, userConfig] = await loadConfig(options)
  const projectAdapters = projectConfig?.adapters as Record<string, unknown> | undefined
  const userAdapters = userConfig?.adapters as Record<string, unknown> | undefined
  return {
    ...(projectAdapters?.[name] as Record<string, unknown> | undefined ?? {}),
    ...(userAdapters?.[name] as Record<string, unknown> | undefined ?? {})
  } as Record<string, unknown>
}
