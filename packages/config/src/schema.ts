/* eslint-disable max-lines -- central schema composition registry */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  adapterConfigCommonSchema,
  baseAdapterEntrySchema,
  baseChannelEntrySchema,
  baseConfigFileSchema,
  buildConfigUiObjectSchema,
  configSectionSchemas
} from '@vibe-forge/core/config-schema'
import type { ChannelDescriptor } from '@vibe-forge/core/channel'
import type { Config, ConfigJsonSchema, ConfigUiSchema } from '@vibe-forge/types'
import { resolveAdapterPackageName } from '@vibe-forge/types'
import { z } from 'zod'

import { buildConfigJsonVariables, loadConfig } from './load'
import { mergeConfigs } from './merge'

type AdapterConfigContribution = import('@vibe-forge/core/config-schema').AdapterConfigContribution

export interface ConfigSchemaBundle {
  fileSchema: z.ZodTypeAny
  sectionSchemas: Record<string, z.ZodTypeAny>
  jsonSchema: ConfigJsonSchema
  uiSchema: ConfigUiSchema
  adapterContributions: readonly AdapterConfigContribution[]
  channelDefinitions: readonly ChannelDescriptor[]
  extensions: {
    adapters: string[]
    channels: string[]
  }
}

export interface ComposeWorkspaceConfigSchemaOptions {
  cwd: string
}

export interface WriteWorkspaceConfigSchemaOptions {
  cwd: string
  bundle?: ConfigSchemaBundle
}

const JSON_SCHEMA_URL = 'http://json-schema.org/draft-07/schema#'
const BASE_SCHEMA_ID = 'https://vibe-forge.ai/schema/config.base.json'
const WORKSPACE_SCHEMA_RELATIVE_PATH = '.ai/schema/config.schema.json'
const nodeRequire = createRequire(__filename)
const repoRoot = resolve(dirname(__filename), '../../..')

const readWorkspacePackageJson = async (cwd: string) => {
  const packageJsonPath = resolve(cwd, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return undefined
  }

  try {
    const content = await readFile(packageJsonPath, 'utf8')
    return JSON.parse(content) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
  } catch {
    return undefined
  }
}

const collectPackageNames = async (cwd: string) => {
  const packageJson = await readWorkspacePackageJson(cwd)
  const packageNames = new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
    ...Object.keys(packageJson?.optionalDependencies ?? {}),
    ...Object.keys(packageJson?.peerDependencies ?? {})
  ])

  const workspacePackageRoots = [
    resolve(cwd, 'packages/adapters'),
    resolve(cwd, 'packages/channels')
  ]

  for (const root of workspacePackageRoots) {
    if (!existsSync(root)) continue

    try {
      const entries = await readdir(root, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const packageJsonPath = resolve(root, entry.name, 'package.json')
        if (!existsSync(packageJsonPath)) continue
        const content = await readFile(packageJsonPath, 'utf8')
        const pkg = JSON.parse(content) as { name?: string }
        if (typeof pkg.name === 'string' && pkg.name.trim() !== '') {
          packageNames.add(pkg.name)
        }
      }
    } catch {}
  }

  return packageNames
}

const collectConfiguredKeys = async (cwd: string) => {
  const [projectConfig, userConfig] = await loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd)
  })
  const mergedConfig = mergeConfigs(projectConfig, userConfig) ?? {} as Config

  const adapters = Object.keys(mergedConfig.adapters ?? {})
  const channels = Object.values(mergedConfig.channels ?? {})
    .flatMap((entry) => {
      if (entry == null || typeof entry !== 'object') return []
      const type = (entry as Record<string, unknown>).type
      return typeof type === 'string' && type.trim() !== '' ? [type] : []
    })

  return { adapters, channels }
}

const isAdapterPackageName = (name: string) => (
  name.startsWith('@vibe-forge/adapter-') ||
  /^@[^/]+\/adapter-/.test(name)
)

const isChannelPackageName = (name: string) => (
  name.startsWith('@vibe-forge/channel-') ||
  /^@[^/]+\/channel-/.test(name)
)

const adapterPackageNameToKey = (packageName: string) => (
  packageName.startsWith('@vibe-forge/adapter-')
    ? packageName.replace('@vibe-forge/adapter-', '')
    : packageName
)

const channelPackageNameToType = (packageName: string) => (
  packageName.startsWith('@vibe-forge/channel-')
    ? packageName.replace('@vibe-forge/channel-', '')
    : packageName
)

const isOptionalLike = (schema: z.ZodTypeAny): boolean => {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) return true
  if (schema instanceof z.ZodEffects) return isOptionalLike(schema.innerType())
  return false
}

const unwrapJsonSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (schema instanceof z.ZodOptional) return unwrapJsonSchema(schema.unwrap())
  if (schema instanceof z.ZodNullable) return unwrapJsonSchema(schema.unwrap())
  if (schema instanceof z.ZodDefault) return unwrapJsonSchema(schema.removeDefault())
  if (schema instanceof z.ZodEffects) return unwrapJsonSchema(schema.innerType())
  return schema
}

const zodToJsonSchema = (schema: z.ZodTypeAny): ConfigJsonSchema => {
  const unwrapped = unwrapJsonSchema(schema)
  const description = unwrapped.description

  if (unwrapped instanceof z.ZodString) {
    return { type: 'string', ...(description ? { description } : {}) }
  }
  if (unwrapped instanceof z.ZodNumber) {
    return { type: 'number', ...(description ? { description } : {}) }
  }
  if (unwrapped instanceof z.ZodBoolean) {
    return { type: 'boolean', ...(description ? { description } : {}) }
  }
  if (unwrapped instanceof z.ZodLiteral) {
    const value = unwrapped.value
    return {
      const: value,
      ...(typeof value === 'string' ? { type: 'string' } : {}),
      ...(typeof value === 'number' ? { type: 'number' } : {}),
      ...(typeof value === 'boolean' ? { type: 'boolean' } : {}),
      ...(description ? { description } : {})
    }
  }
  if (unwrapped instanceof z.ZodEnum) {
    return { type: 'string', enum: [...unwrapped.options], ...(description ? { description } : {}) }
  }
  if (unwrapped instanceof z.ZodNativeEnum) {
    return {
      type: 'string',
      enum: Object.values(unwrapped.enum).map(value => String(value)),
      ...(description ? { description } : {})
    }
  }
  if (unwrapped instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(unwrapped.element),
      ...(description ? { description } : {})
    }
  }
  if (unwrapped instanceof z.ZodUnion) {
    return {
      anyOf: unwrapped._def.options.map((option: z.ZodTypeAny) => zodToJsonSchema(option)),
      ...(description ? { description } : {})
    }
  }
  if (unwrapped instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: zodToJsonSchema(unwrapped._def.valueType),
      ...(description ? { description } : {})
    }
  }
  if (unwrapped instanceof z.ZodObject) {
    const shapeEntries = Object.entries(unwrapped.shape) as Array<[string, z.ZodTypeAny]>
    const properties = Object.fromEntries(
      shapeEntries.map(([key, value]) => [key, zodToJsonSchema(value)])
    )
    const required = shapeEntries
      .filter(([, value]) => !isOptionalLike(value))
      .map(([key]) => key)

    const catchall = unwrapped._def.catchall
    const additionalProperties = catchall != null && !(catchall instanceof z.ZodNever)
      ? zodToJsonSchema(catchall)
      : unwrapped._def.unknownKeys === 'passthrough'

    return {
      type: 'object',
      properties,
      additionalProperties,
      ...(required.length > 0 ? { required } : {}),
      ...(description ? { description } : {})
    }
  }
  if (unwrapped instanceof z.ZodNull) {
    return { type: 'null', ...(description ? { description } : {}) }
  }

  return description ? { description } : {}
}

const composeAdapterEntrySchema = (contribution: AdapterConfigContribution) => (
  adapterConfigCommonSchema.merge(contribution.schema)
)

const createAdaptersSectionSchema = (contributions: readonly AdapterConfigContribution[]) => (
  z.object(
    Object.fromEntries(
      contributions.map(contribution => [contribution.adapterKey, composeAdapterEntrySchema(contribution).optional()])
    )
  ).catchall(baseAdapterEntrySchema)
)

const createChannelsSectionSchema = (definitions: readonly ChannelDescriptor[]) => {
  if (definitions.length === 0) {
    return z.record(z.string(), baseChannelEntrySchema)
  }

  const variants = [
    ...definitions.map(definition => definition.configSchema),
    baseChannelEntrySchema
  ] as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]

  return z.record(z.string(), z.union(variants))
}

const createFileSchema = (
  adaptersSectionSchema: z.ZodTypeAny,
  channelsSectionSchema: z.ZodTypeAny
) => (
  baseConfigFileSchema.extend({
    adapters: adaptersSectionSchema.optional(),
    channels: channelsSectionSchema.optional()
  })
)

const createUiSchema = (
  adapterContributions: readonly AdapterConfigContribution[],
  channelDefinitions: readonly ChannelDescriptor[]
): ConfigUiSchema => ({
  version: 1,
  sections: {
    adapters: {
      key: 'adapters',
      title: 'Adapters',
      kind: 'recordMap',
      recordMap: {
        mode: 'keyed',
        keyPlaceholder: 'Adapter key',
        entryKinds: adapterContributions.map(contribution => ({
          key: contribution.adapterKey,
          label: contribution.title,
          description: contribution.description
        })),
        schemas: Object.fromEntries(
          adapterContributions.map(contribution => [
            contribution.adapterKey,
            contribution.uiSchema ?? buildConfigUiObjectSchema(composeAdapterEntrySchema(contribution))
          ])
        ),
        unknownSchema: buildConfigUiObjectSchema(baseAdapterEntrySchema),
        unknownEditor: 'json'
      }
    },
    channels: {
      key: 'channels',
      title: 'Channels',
      kind: 'recordMap',
      recordMap: {
        mode: 'discriminated',
        keyPlaceholder: 'Channel name',
        discriminatorField: 'type',
        entryKinds: channelDefinitions.map(definition => ({
          key: definition.type,
          label: definition.label,
          description: definition.description
        })),
        schemas: Object.fromEntries(
          channelDefinitions.map(definition => [definition.type, buildConfigUiObjectSchema(definition.configSchema)])
        ),
        unknownSchema: buildConfigUiObjectSchema(baseChannelEntrySchema),
        unknownEditor: 'json'
      }
    }
  }
})

const createBundle = (
  schemaId: string,
  adapterContributions: readonly AdapterConfigContribution[],
  channelDefinitions: readonly ChannelDescriptor[]
): ConfigSchemaBundle => {
  const adaptersSectionSchema = createAdaptersSectionSchema(adapterContributions)
  const channelsSectionSchema = createChannelsSectionSchema(channelDefinitions)
  const fileSchema = createFileSchema(adaptersSectionSchema, channelsSectionSchema)
  const sectionSchemas = {
    ...configSectionSchemas,
    adapters: adaptersSectionSchema,
    channels: channelsSectionSchema
  } satisfies Record<string, z.ZodTypeAny>

  return {
    fileSchema,
    sectionSchemas,
    jsonSchema: {
      $schema: JSON_SCHEMA_URL,
      $id: schemaId,
      ...zodToJsonSchema(fileSchema)
    },
    uiSchema: createUiSchema(adapterContributions, channelDefinitions),
    adapterContributions,
    channelDefinitions,
    extensions: {
      adapters: adapterContributions.map(contribution => contribution.adapterKey),
      channels: channelDefinitions.map(definition => definition.type)
    }
  }
}

const resolveLocalWorkspaceSourcePath = (packageName: string, subpath: string) => {
  if (packageName.startsWith('@vibe-forge/adapter-')) {
    const adapterName = packageName.replace('@vibe-forge/adapter-', '')
    const sourcePath = subpath === './config-schema'
      ? resolve(repoRoot, 'packages/adapters', adapterName, 'src/config-schema.ts')
      : resolve(repoRoot, 'packages/adapters', adapterName, 'src/index.ts')
    return existsSync(sourcePath) ? sourcePath : undefined
  }

  if (packageName.startsWith('@vibe-forge/channel-')) {
    const channelName = packageName.replace('@vibe-forge/channel-', '')
    const sourcePath = resolve(repoRoot, 'packages/channels', channelName, 'src/index.ts')
    return existsSync(sourcePath) ? sourcePath : undefined
  }

  return undefined
}

const loadPackageSubpathWithSourceFallback = async (packageName: string, subpath: string) => {
  const normalizedSubpath = subpath === ''
    ? ''
    : subpath.startsWith('./')
    ? subpath.slice(1)
    : subpath
  const specifier = `${packageName}${normalizedSubpath}`
  const exportKey = subpath === ''
    ? '.'
    : subpath.startsWith('./')
    ? subpath
    : `.${subpath}`

  try {
    return nodeRequire(specifier) as Record<string, unknown>
  } catch {
    const localSourcePath = resolveLocalWorkspaceSourcePath(packageName, subpath)
    if (localSourcePath != null) {
      try {
        return await import(pathToFileURL(localSourcePath).href) as Record<string, unknown>
      } catch {}
    }

    try {
      const packageJsonPath = nodeRequire.resolve(`${packageName}/package.json`)
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        exports?: Record<string, { '__vibe-forge__'?: { default?: string } }>
      }
      const sourceRelativePath = packageJson.exports?.[exportKey]?.['__vibe-forge__']?.default
      if (typeof sourceRelativePath !== 'string' || sourceRelativePath.trim() === '') {
        return undefined
      }
      return await import(pathToFileURL(resolve(dirname(packageJsonPath), sourceRelativePath)).href) as Record<string, unknown>
    } catch {
      return undefined
    }
  }
}

const loadAdapterContribution = async (specifierOrKey: string): Promise<AdapterConfigContribution | undefined> => {
  const packageName = specifierOrKey.startsWith('@')
    ? specifierOrKey
    : resolveAdapterPackageName(specifierOrKey)

  const mod = await loadPackageSubpathWithSourceFallback(packageName, './config-schema') as {
    adapterConfigContribution?: AdapterConfigContribution
  } | undefined
  return mod?.adapterConfigContribution
}

const loadChannelDefinition = async (specifierOrType: string): Promise<ChannelDescriptor | undefined> => {
  const packageName = specifierOrType.startsWith('@')
    ? specifierOrType
    : `@vibe-forge/channel-${specifierOrType}`

  const mod = await loadPackageSubpathWithSourceFallback(packageName, '') as {
    channelDefinition?: ChannelDescriptor
  } | undefined
  return mod?.channelDefinition
}

const runAdapterValidators = (
  adapters: unknown,
  contributions: readonly AdapterConfigContribution[]
) => {
  if (adapters == null || typeof adapters !== 'object') return []

  const adapterRecord = adapters as Record<string, unknown>
  return contributions.flatMap((contribution) => {
    const validator = contribution.validate
    if (validator == null) return []

    const value = adapterRecord[contribution.adapterKey]
    if (value == null) return []

    const parsed = contribution.schema.safeParse(value)
    if (!parsed.success) return []

    return [...(validator(parsed.data) ?? [])]
  })
}

export const composeBaseConfigSchemaBundle = () => createBundle(
  BASE_SCHEMA_ID,
  [],
  []
)

export const composeWorkspaceConfigSchemaBundle = async (
  options: ComposeWorkspaceConfigSchemaOptions
) => {
  const [packageNames, configuredKeys] = await Promise.all([
    collectPackageNames(options.cwd),
    collectConfiguredKeys(options.cwd)
  ])

  const adapterSpecifiers = new Set<string>([
    ...configuredKeys.adapters,
    ...Array.from(packageNames).filter(isAdapterPackageName).map(adapterPackageNameToKey)
  ])
  const channelSpecifiers = new Set<string>([
    ...configuredKeys.channels,
    ...Array.from(packageNames).filter(isChannelPackageName).map(channelPackageNameToType)
  ])

  const adapterContributions = (
    await Promise.all(Array.from(adapterSpecifiers).map(async specifier => await loadAdapterContribution(specifier)))
  ).filter((contribution): contribution is AdapterConfigContribution => contribution != null)

  const channelDefinitions = (
    await Promise.all(Array.from(channelSpecifiers).map(async specifier => await loadChannelDefinition(specifier)))
  ).filter((definition): definition is ChannelDescriptor => definition != null)

  return createBundle(
    `file://${resolve(options.cwd, WORKSPACE_SCHEMA_RELATIVE_PATH)}`,
    adapterContributions,
    channelDefinitions
  )
}

export const validateConfigFileObject = async (
  value: unknown,
  options?: Partial<ComposeWorkspaceConfigSchemaOptions>
) => {
  const bundle = options?.cwd == null
    ? composeBaseConfigSchemaBundle()
    : await composeWorkspaceConfigSchemaBundle({ cwd: options.cwd })

  const parsed = bundle.fileSchema.safeParse(value)
  if (!parsed.success) {
    return parsed
  }

  const issues = runAdapterValidators((parsed.data as Config).adapters, await (async () => {
    if (options?.cwd == null) return []
    const workspaceBundle = await composeWorkspaceConfigSchemaBundle({ cwd: options.cwd })
    return workspaceBundle.adapterContributions
  })())

  if (issues.length === 0) {
    return parsed
  }

  return {
    success: false as const,
    error: new z.ZodError(issues.map(issue => ({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: issue.path ?? []
    })))
  }
}

export const validateConfigSection = async (
  section: string,
  value: unknown,
  options?: Partial<ComposeWorkspaceConfigSchemaOptions>
) => {
  const bundle = options?.cwd == null
    ? composeBaseConfigSchemaBundle()
    : await composeWorkspaceConfigSchemaBundle({ cwd: options.cwd })

  const sectionSchema = bundle.sectionSchemas[section]
  if (sectionSchema == null) {
    return {
      success: false as const,
      error: new z.ZodError([{
        code: z.ZodIssueCode.custom,
        message: `Unknown config section "${section}"`,
        path: ['section']
      }])
    }
  }

  const parsed = sectionSchema.safeParse(value)
  if (!parsed.success) {
    return parsed
  }

  if (section !== 'adapters') {
    return parsed
  }

  const issues = runAdapterValidators(parsed.data, bundle.adapterContributions)

  if (issues.length === 0) {
    return parsed
  }

  return {
    success: false as const,
    error: new z.ZodError(issues.map(issue => ({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: issue.path ?? []
    })))
  }
}

export const writeWorkspaceConfigSchemaFile = async (
  options: WriteWorkspaceConfigSchemaOptions
) => {
  const bundle = options.bundle ?? await composeWorkspaceConfigSchemaBundle({ cwd: options.cwd })
  const outputPath = resolve(options.cwd, WORKSPACE_SCHEMA_RELATIVE_PATH)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(bundle.jsonSchema, null, 2)}\n`, 'utf8')

  return {
    outputPath,
    bundle
  }
}
