/* eslint-disable max-lines -- central schema composition registry */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { ChannelDescriptor } from '@vibe-forge/core/channel'
import {
  adapterConfigCommonSchema,
  baseAdapterEntrySchema,
  baseChannelEntrySchema,
  baseConfigFileSchema,
  buildConfigUiObjectSchema,
  configSectionSchemas
} from '@vibe-forge/core/config-schema'
import type { Config, ConfigJsonSchema, ConfigUiSchema } from '@vibe-forge/types'
import { resolveAdapterPackageName } from '@vibe-forge/types'
import { z } from 'zod'

import { buildConfigJsonVariables, loadConfigState } from './load'

type AdapterConfigContribution = import('@vibe-forge/core/config-schema').AdapterConfigContribution

interface ResolvedAdapterSchemaEntry {
  configKey: string
  contribution: AdapterConfigContribution
  isAlias: boolean
}

export interface ConfigSchemaBundle {
  fileSchema: z.ZodTypeAny
  sectionSchemas: Record<string, z.ZodTypeAny>
  jsonSchema: ConfigJsonSchema
  uiSchema: ConfigUiSchema
  adapterEntries: readonly ResolvedAdapterSchemaEntry[]
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
const createWorkspaceRequire = (cwd: string) => createRequire(resolve(cwd, '__vf_config_schema_loader__.cjs'))

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
  const { mergedConfig } = await loadConfigState({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd)
  })

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

const getZodTypeName = (schema: z.ZodTypeAny) => (
  (schema as { _def?: { typeName?: string } })._def?.typeName
)

const isZodType = (schema: z.ZodTypeAny, typeName: string) => getZodTypeName(schema) === typeName

const getSchemaInnerType = (schema: z.ZodTypeAny) => (
  (schema as unknown as { innerType: () => z.ZodTypeAny }).innerType()
)

const getSchemaUnwrapped = (schema: z.ZodTypeAny) => (
  (schema as unknown as { unwrap: () => z.ZodTypeAny }).unwrap()
)

const getSchemaWithoutDefault = (schema: z.ZodTypeAny) => (
  (schema as unknown as { removeDefault: () => z.ZodTypeAny }).removeDefault()
)

const getSchemaShape = (schema: z.ZodTypeAny) => (
  (schema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape
)

const getSchemaCatchall = (schema: z.ZodTypeAny) => (
  (schema as unknown as { _def?: { catchall?: z.ZodTypeAny } })._def?.catchall
)

const getSchemaUnknownKeys = (schema: z.ZodTypeAny) => (
  (schema as unknown as { _def?: { unknownKeys?: string } })._def?.unknownKeys
)

const getArrayElementSchema = (schema: z.ZodTypeAny) => (
  (schema as unknown as { element: z.ZodTypeAny }).element
)

const getRecordValueSchema = (schema: z.ZodTypeAny) => (
  (schema as unknown as { _def: { valueType: z.ZodTypeAny } })._def.valueType
)

const getUnionOptions = (schema: z.ZodTypeAny) => (
  (schema as unknown as { _def: { options: z.ZodTypeAny[] } })._def.options
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

const legacyAdapterConfigAliasSchema = z.object({
  model: z.string().optional().describe('Legacy alias for defaultModel')
})

const isOptionalLike = (schema: z.ZodTypeAny): boolean => {
  if (isZodType(schema, 'ZodOptional') || isZodType(schema, 'ZodDefault')) return true
  if (isZodType(schema, 'ZodEffects')) {
    return isOptionalLike((schema as unknown as { innerType: () => z.ZodTypeAny }).innerType())
  }
  return false
}

const unwrapJsonSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (isZodType(schema, 'ZodOptional') || isZodType(schema, 'ZodNullable')) {
    return unwrapJsonSchema(getSchemaUnwrapped(schema))
  }
  if (isZodType(schema, 'ZodDefault')) {
    return unwrapJsonSchema(getSchemaWithoutDefault(schema))
  }
  if (isZodType(schema, 'ZodEffects')) {
    return unwrapJsonSchema(getSchemaInnerType(schema))
  }
  return schema
}

const zodToJsonSchema = (schema: z.ZodTypeAny): ConfigJsonSchema => {
  const unwrapped = unwrapJsonSchema(schema)
  const description = unwrapped.description

  if (isZodType(unwrapped, 'ZodString')) {
    return { type: 'string', ...(description ? { description } : {}) }
  }
  if (isZodType(unwrapped, 'ZodNumber')) {
    return { type: 'number', ...(description ? { description } : {}) }
  }
  if (isZodType(unwrapped, 'ZodBoolean')) {
    return { type: 'boolean', ...(description ? { description } : {}) }
  }
  if (isZodType(unwrapped, 'ZodLiteral')) {
    const value = (unwrapped as unknown as { value: unknown }).value
    return {
      const: value,
      ...(typeof value === 'string' ? { type: 'string' } : {}),
      ...(typeof value === 'number' ? { type: 'number' } : {}),
      ...(typeof value === 'boolean' ? { type: 'boolean' } : {}),
      ...(description ? { description } : {})
    }
  }
  if (isZodType(unwrapped, 'ZodEnum')) {
    return {
      type: 'string',
      enum: [...((unwrapped as unknown as { options: string[] }).options)],
      ...(description ? { description } : {})
    }
  }
  if (isZodType(unwrapped, 'ZodNativeEnum')) {
    return {
      type: 'string',
      enum: Object.values((unwrapped as unknown as { enum: Record<string, string | number> }).enum)
        .map(value => String(value)),
      ...(description ? { description } : {})
    }
  }
  if (isZodType(unwrapped, 'ZodArray')) {
    return {
      type: 'array',
      items: zodToJsonSchema((unwrapped as unknown as { element: z.ZodTypeAny }).element),
      ...(description ? { description } : {})
    }
  }
  if (isZodType(unwrapped, 'ZodUnion')) {
    return {
      anyOf: (unwrapped as unknown as { _def: { options: z.ZodTypeAny[] } })._def.options
        .map(option => zodToJsonSchema(option)),
      ...(description ? { description } : {})
    }
  }
  if (isZodType(unwrapped, 'ZodRecord')) {
    return {
      type: 'object',
      additionalProperties: zodToJsonSchema(getRecordValueSchema(unwrapped)),
      ...(description ? { description } : {})
    }
  }
  if (isZodType(unwrapped, 'ZodObject')) {
    const shapeEntries = Object.entries(getSchemaShape(unwrapped)) as Array<[string, z.ZodTypeAny]>
    const properties = Object.fromEntries(
      shapeEntries.map(([key, value]) => [key, zodToJsonSchema(value)])
    )
    const required = shapeEntries
      .filter(([, value]) => !isOptionalLike(value))
      .map(([key]) => key)

    const catchall = getSchemaCatchall(unwrapped)
    const additionalProperties = catchall != null && !isZodType(catchall, 'ZodNever')
      ? zodToJsonSchema(catchall)
      : getSchemaUnknownKeys(unwrapped) === 'passthrough'

    return {
      type: 'object',
      properties,
      additionalProperties,
      ...(required.length > 0 ? { required } : {}),
      ...(description ? { description } : {})
    }
  }
  if (isZodType(unwrapped, 'ZodNull')) {
    return { type: 'null', ...(description ? { description } : {}) }
  }

  return description ? { description } : {}
}

const composeAdapterEntrySchema = (contribution: AdapterConfigContribution) => (
  adapterConfigCommonSchema.merge(contribution.schema)
)

const composeAdapterEntryValidationSchema = (contribution: AdapterConfigContribution) => (
  composeAdapterEntrySchema(contribution).merge(legacyAdapterConfigAliasSchema)
)

const resolveAdapterSchemaEntry = (
  configKey: string,
  contribution: AdapterConfigContribution
): ResolvedAdapterSchemaEntry => ({
  configKey,
  contribution,
  isAlias: configKey !== contribution.adapterKey
})

const dedupeResolvedAdapterSchemaEntries = (entries: readonly ResolvedAdapterSchemaEntry[]) =>
  Array.from(
    new Map(entries.map(entry => [entry.configKey, entry])).values()
  )

const getPreferredAdapterEntries = (entries: readonly ResolvedAdapterSchemaEntry[]) => (
  Array.from(
    new Map(entries.map(entry => [entry.contribution.adapterKey, entry])).values()
  ).map((entry) => {
    const exactEntry = entries.find(candidate => (
      candidate.contribution.adapterKey === entry.contribution.adapterKey &&
      candidate.isAlias === false
    ))
    return exactEntry ?? entry
  })
)

const createAdaptersSectionSchema = (entries: readonly ResolvedAdapterSchemaEntry[]) => (
  z.object(
    Object.fromEntries(
      entries.map(entry => [
        entry.configKey,
        composeAdapterEntryValidationSchema(entry.contribution).optional()
      ])
    )
  ).catchall(baseAdapterEntrySchema)
)

const getKnownChannelDefinition = (
  definitionsByType: ReadonlyMap<string, ChannelDescriptor>,
  value: unknown
) => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const type = (value as Record<string, unknown>).type
  return typeof type === 'string' ? definitionsByType.get(type) : undefined
}

const getChannelEntrySchema = (
  definitionsByType: ReadonlyMap<string, ChannelDescriptor>,
  value: unknown
) => getKnownChannelDefinition(definitionsByType, value)?.configSchema ?? baseChannelEntrySchema

const addPrefixedZodIssues = (
  ctx: z.RefinementCtx,
  pathPrefix: string,
  issues: readonly z.ZodIssue[]
) => {
  for (const issue of issues) {
    ctx.addIssue({
      ...issue,
      path: [pathPrefix, ...issue.path]
    })
  }
}

const createChannelsSectionSchema = (definitions: readonly ChannelDescriptor[]) => {
  if (definitions.length === 0) {
    return z.record(z.string(), baseChannelEntrySchema)
  }

  const definitionsByType = new Map(definitions.map(definition => [definition.type, definition]))

  return z.record(z.string(), z.unknown())
    .transform((channels, ctx) => {
      const normalizedEntries: Array<[string, unknown]> = []

      for (const [channelKey, channelValue] of Object.entries(channels)) {
        const channelSchema = getChannelEntrySchema(definitionsByType, channelValue)
        const parsed = channelSchema.safeParse(channelValue)
        if (!parsed.success) {
          addPrefixedZodIssues(ctx, channelKey, parsed.error.issues)
          normalizedEntries.push([channelKey, channelValue])
          continue
        }

        const knownDefinition = getKnownChannelDefinition(definitionsByType, channelValue)
        if (knownDefinition != null) {
          for (
            const issue of collectKnownSchemaUnknownKeyIssues(knownDefinition.configSchema, channelValue, [channelKey])
          ) {
            ctx.addIssue(issue)
          }
        }

        normalizedEntries.push([channelKey, parsed.data])
      }

      return Object.fromEntries(normalizedEntries)
    })
}

const createUnknownKeyIssue = (path: string[], key: string): z.ZodIssue => ({
  code: z.ZodIssueCode.unrecognized_keys,
  keys: [key],
  path,
  message: `Unrecognized key(s) in object: '${key}'`
})

const collectKnownSchemaUnknownKeyIssues = (
  schema: z.ZodTypeAny,
  value: unknown,
  path: string[] = []
): z.ZodIssue[] => {
  if (value == null) {
    return []
  }

  if (isZodType(schema, 'ZodOptional') || isZodType(schema, 'ZodNullable')) {
    return collectKnownSchemaUnknownKeyIssues(getSchemaUnwrapped(schema), value, path)
  }
  if (isZodType(schema, 'ZodDefault')) {
    return collectKnownSchemaUnknownKeyIssues(getSchemaWithoutDefault(schema), value, path)
  }
  if (isZodType(schema, 'ZodEffects')) {
    return collectKnownSchemaUnknownKeyIssues(getSchemaInnerType(schema), value, path)
  }
  if (isZodType(schema, 'ZodArray')) {
    if (!Array.isArray(value)) {
      return []
    }
    return value.flatMap((item, index) =>
      collectKnownSchemaUnknownKeyIssues(
        getArrayElementSchema(schema),
        item,
        [...path, String(index)]
      )
    )
  }
  if (isZodType(schema, 'ZodRecord')) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      return []
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      collectKnownSchemaUnknownKeyIssues(
        getRecordValueSchema(schema),
        item,
        [...path, key]
      )
    )
  }
  if (isZodType(schema, 'ZodUnion')) {
    const matchedOption = getUnionOptions(schema).find(option => option.safeParse(value).success)
    return matchedOption == null ? [] : collectKnownSchemaUnknownKeyIssues(matchedOption, value, path)
  }
  if (!isZodType(schema, 'ZodObject') || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  const shape = getSchemaShape(schema)
  const catchall = getSchemaCatchall(schema)
  const unknownKeys = getSchemaUnknownKeys(schema)
  const recordValue = value as Record<string, unknown>
  const issues: z.ZodIssue[] = []

  for (const [key, item] of Object.entries(recordValue)) {
    if (Object.hasOwn(shape, key)) {
      issues.push(...collectKnownSchemaUnknownKeyIssues(shape[key], item, [...path, key]))
      continue
    }

    if (catchall != null && !isZodType(catchall, 'ZodNever')) {
      issues.push(...collectKnownSchemaUnknownKeyIssues(catchall, item, [...path, key]))
      continue
    }

    if (unknownKeys === 'passthrough') {
      continue
    }

    issues.push(createUnknownKeyIssue(path, key))
  }

  return issues
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
  adapterEntries: readonly ResolvedAdapterSchemaEntry[],
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
        entryKinds: getPreferredAdapterEntries(adapterEntries).map(entry => ({
          key: entry.configKey,
          label: entry.contribution.title,
          description: entry.contribution.description
        })),
        schemas: Object.fromEntries(
          adapterEntries.map(entry => [
            entry.configKey,
            entry.contribution.uiSchema ?? buildConfigUiObjectSchema(composeAdapterEntrySchema(entry.contribution))
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

const createChannelsSectionJsonSchema = (
  channelDefinitions: readonly ChannelDescriptor[]
): ConfigJsonSchema => {
  const fallbackSchema = zodToJsonSchema(baseChannelEntrySchema)
  if (channelDefinitions.length === 0) {
    return {
      type: 'object',
      additionalProperties: fallbackSchema
    }
  }

  return {
    type: 'object',
    additionalProperties: {
      anyOf: [
        ...channelDefinitions.map(definition => zodToJsonSchema(definition.configSchema)),
        {
          allOf: [
            fallbackSchema,
            {
              not: {
                type: 'object',
                required: ['type'],
                properties: {
                  type: {
                    enum: channelDefinitions.map(definition => definition.type)
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
}

const createBundle = (
  schemaId: string,
  adapterEntries: readonly ResolvedAdapterSchemaEntry[],
  channelDefinitions: readonly ChannelDescriptor[]
): ConfigSchemaBundle => {
  const adaptersSectionSchema = createAdaptersSectionSchema(adapterEntries)
  const channelsSectionSchema = createChannelsSectionSchema(channelDefinitions)
  const fileSchema = createFileSchema(adaptersSectionSchema, channelsSectionSchema)
  const sectionSchemas = {
    ...configSectionSchemas,
    adapters: adaptersSectionSchema,
    channels: channelsSectionSchema
  } satisfies Record<string, z.ZodTypeAny>

  const jsonSchema: ConfigJsonSchema = {
    $schema: JSON_SCHEMA_URL,
    $id: schemaId,
    ...zodToJsonSchema(fileSchema)
  }
  const jsonSchemaRecord = jsonSchema as Record<string, unknown>

  const jsonSchemaProperties = (
      jsonSchemaRecord.properties != null &&
      typeof jsonSchemaRecord.properties === 'object' &&
      !Array.isArray(jsonSchemaRecord.properties)
    )
    ? { ...(jsonSchemaRecord.properties as Record<string, unknown>) }
    : {}
  jsonSchemaProperties.channels = createChannelsSectionJsonSchema(channelDefinitions)
  jsonSchemaRecord.properties = jsonSchemaProperties

  return {
    fileSchema,
    sectionSchemas,
    jsonSchema,
    uiSchema: createUiSchema(adapterEntries, channelDefinitions),
    adapterEntries,
    channelDefinitions,
    extensions: {
      adapters: getPreferredAdapterEntries(adapterEntries).map(entry => entry.configKey),
      channels: channelDefinitions.map(definition => definition.type)
    }
  }
}

const resolveLocalWorkspaceSourcePath = (packageName: string, subpath: string, cwd: string) => {
  const workspaceRoots = new Set([cwd, repoRoot])

  for (const workspaceRoot of workspaceRoots) {
    if (packageName.startsWith('@vibe-forge/adapter-')) {
      const adapterName = packageName.replace('@vibe-forge/adapter-', '')
      const sourcePath = subpath === './config-schema'
        ? resolve(workspaceRoot, 'packages/adapters', adapterName, 'src/config-schema.ts')
        : resolve(workspaceRoot, 'packages/adapters', adapterName, 'src/index.ts')
      if (existsSync(sourcePath)) {
        return sourcePath
      }
    }

    if (packageName.startsWith('@vibe-forge/channel-')) {
      const channelName = packageName.replace('@vibe-forge/channel-', '')
      const sourcePath = resolve(workspaceRoot, 'packages/channels', channelName, 'src/index.ts')
      if (existsSync(sourcePath)) {
        return sourcePath
      }
    }
  }

  return undefined
}

const getParentDirectories = (cwd: string) => {
  const directories: string[] = []
  let current = resolve(cwd)

  while (true) {
    directories.push(current)
    const parent = dirname(current)
    if (parent === current) {
      return directories
    }
    current = parent
  }
}

const resolvePackageJsonFromNodeModules = (packageName: string, cwd: string) => {
  for (const directory of getParentDirectories(cwd)) {
    const candidate = resolve(directory, 'node_modules', ...packageName.split('/'), 'package.json')
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

const resolvePackageJsonPath = (packageName: string, cwd: string) => {
  const workspaceNodeModulesPath = resolvePackageJsonFromNodeModules(packageName, cwd)
  if (workspaceNodeModulesPath != null) {
    return workspaceNodeModulesPath
  }

  const repoNodeModulesPath = resolvePackageJsonFromNodeModules(packageName, repoRoot)
  if (repoNodeModulesPath != null) {
    return repoNodeModulesPath
  }

  try {
    return createWorkspaceRequire(cwd).resolve(`${packageName}/package.json`)
  } catch {}

  try {
    return nodeRequire.resolve(`${packageName}/package.json`)
  } catch {
    return undefined
  }
}

const resolvePackageExportTarget = (
  entry: unknown,
  preferredConditions: readonly string[],
  patternMatch?: string
): string | undefined => {
  if (typeof entry === 'string') {
    return patternMatch == null ? entry : entry.replaceAll('*', patternMatch)
  }
  if (Array.isArray(entry)) {
    for (const item of entry) {
      const resolved = resolvePackageExportTarget(item, preferredConditions, patternMatch)
      if (resolved != null) {
        return resolved
      }
    }
    return undefined
  }
  if (entry == null || typeof entry !== 'object') {
    return undefined
  }

  const record = entry as Record<string, unknown>
  for (const condition of preferredConditions) {
    const resolved = resolvePackageExportTarget(record[condition], preferredConditions, patternMatch)
    if (resolved != null) {
      return resolved
    }
  }

  for (const value of Object.values(record)) {
    const resolved = resolvePackageExportTarget(value, preferredConditions, patternMatch)
    if (resolved != null) {
      return resolved
    }
  }

  return undefined
}

const matchPackageExportPattern = (patternKey: string, exportKey: string) => {
  const wildcardIndex = patternKey.indexOf('*')
  if (wildcardIndex < 0) {
    return undefined
  }

  const prefix = patternKey.slice(0, wildcardIndex)
  const suffix = patternKey.slice(wildcardIndex + 1)
  if (!exportKey.startsWith(prefix) || !exportKey.endsWith(suffix)) {
    return undefined
  }

  return exportKey.slice(prefix.length, exportKey.length - suffix.length)
}

const comparePackageExportPatternSpecificity = (
  left: { key: string },
  right: { key: string }
) => {
  const leftWildcardIndex = left.key.indexOf('*')
  const rightWildcardIndex = right.key.indexOf('*')

  const leftPrefixLength = leftWildcardIndex < 0 ? left.key.length : leftWildcardIndex
  const rightPrefixLength = rightWildcardIndex < 0 ? right.key.length : rightWildcardIndex
  if (leftPrefixLength !== rightPrefixLength) {
    return rightPrefixLength - leftPrefixLength
  }

  const leftSuffixLength = leftWildcardIndex < 0 ? 0 : left.key.length - leftWildcardIndex - 1
  const rightSuffixLength = rightWildcardIndex < 0 ? 0 : right.key.length - rightWildcardIndex - 1
  if (leftSuffixLength !== rightSuffixLength) {
    return rightSuffixLength - leftSuffixLength
  }

  return right.key.length - left.key.length
}

const resolvePackageExportEntry = (
  exportsField: unknown,
  exportKey: string
): { entry: unknown; patternMatch?: string } | undefined => {
  if (exportKey === '.') {
    if (
      exportsField != null &&
      typeof exportsField === 'object' &&
      !Array.isArray(exportsField) &&
      Object.hasOwn(exportsField as Record<string, unknown>, '.')
    ) {
      return { entry: (exportsField as Record<string, unknown>)['.'] }
    }
    return { entry: exportsField }
  }

  if (exportsField == null || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return undefined
  }

  const exportsRecord = exportsField as Record<string, unknown>
  if (Object.hasOwn(exportsRecord, exportKey)) {
    return { entry: exportsRecord[exportKey] }
  }

  const matchedPattern = Object.keys(exportsRecord)
    .filter(key => key.startsWith('./') && key.includes('*'))
    .map((key) => {
      const patternMatch = matchPackageExportPattern(key, exportKey)
      return patternMatch == null ? undefined : { key, patternMatch }
    })
    .filter((match): match is { key: string; patternMatch: string } => match != null)
    .sort(comparePackageExportPatternSpecificity)[0]

  if (matchedPattern == null) {
    return undefined
  }

  return {
    entry: exportsRecord[matchedPattern.key],
    patternMatch: matchedPattern.patternMatch
  }
}

const resolvePackageExportPath = (
  packageJsonPath: string,
  exportKey: string,
  preferredConditions: readonly string[]
) => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: unknown
    main?: string
    module?: string
  }
  const exportsField = packageJson.exports
  const resolvedExport = resolvePackageExportEntry(exportsField, exportKey)
  const exportPath = resolvedExport == null
    ? undefined
    : resolvePackageExportTarget(
      resolvedExport.entry,
      preferredConditions,
      resolvedExport.patternMatch
    )
  if (exportPath != null) {
    return resolve(dirname(packageJsonPath), exportPath)
  }
  if (exportKey === '.') {
    const entryPath = packageJson.module ?? packageJson.main
    if (typeof entryPath === 'string' && entryPath.trim() !== '') {
      return resolve(dirname(packageJsonPath), entryPath)
    }
  }
  return undefined
}

const loadPackageSubpathWithSourceFallback = async (packageName: string, subpath: string, cwd: string) => {
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
  const workspaceRequire = createWorkspaceRequire(cwd)
  const loadFromPackageExport = async (
    preferredConditions: readonly string[]
  ) => {
    const packageJsonPath = resolvePackageJsonPath(packageName, cwd)
    if (packageJsonPath == null) {
      return undefined
    }

    const exportPath = resolvePackageExportPath(packageJsonPath, exportKey, preferredConditions)
    if (exportPath == null) {
      return undefined
    }

    try {
      return await import(pathToFileURL(exportPath).href) as Record<string, unknown>
    } catch {
      return undefined
    }
  }
  const importFromResolver = async (resolver: NodeJS.Require) => {
    try {
      const resolvedPath = resolver.resolve(specifier)
      return await import(pathToFileURL(resolvedPath).href) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  try {
    return workspaceRequire(specifier) as Record<string, unknown>
  } catch {
    const workspaceImportedModule = await importFromResolver(workspaceRequire)
    if (workspaceImportedModule != null) {
      return workspaceImportedModule
    }

    try {
      return nodeRequire(specifier) as Record<string, unknown>
    } catch {}

    const repoImportedModule = await importFromResolver(nodeRequire)
    if (repoImportedModule != null) {
      return repoImportedModule
    }

    const workspaceRuntimeExportModule = await loadFromPackageExport(['import', 'default', 'require', 'node'])
    if (workspaceRuntimeExportModule != null) {
      return workspaceRuntimeExportModule
    }

    const localSourcePath = resolveLocalWorkspaceSourcePath(packageName, subpath, cwd)
    if (localSourcePath != null) {
      try {
        return await import(pathToFileURL(localSourcePath).href) as Record<string, unknown>
      } catch {}
    }

    const workspaceSourceExportModule = await loadFromPackageExport(['__vibe-forge__', 'default'])
    if (workspaceSourceExportModule != null) {
      return workspaceSourceExportModule
    }

    return undefined
  }
}

const loadAdapterContribution = async (
  specifierOrKey: string,
  cwd: string
): Promise<AdapterConfigContribution | undefined> => {
  const packageName = specifierOrKey.startsWith('@')
    ? specifierOrKey
    : resolveAdapterPackageName(specifierOrKey)

  const mod = await loadPackageSubpathWithSourceFallback(packageName, './config-schema', cwd) as {
    adapterConfigContribution?: AdapterConfigContribution
  } | undefined
  const contribution = mod?.adapterConfigContribution
  if (contribution == null) {
    return undefined
  }

  return packageName.startsWith('@vibe-forge/adapter-')
    ? contribution
    : {
      ...contribution,
      adapterKey: packageName
    }
}

const loadChannelDefinition = async (
  specifierOrType: string,
  cwd: string
): Promise<ChannelDescriptor | undefined> => {
  const packageName = specifierOrType.startsWith('@')
    ? specifierOrType
    : `@vibe-forge/channel-${specifierOrType}`

  const mod = await loadPackageSubpathWithSourceFallback(packageName, '', cwd) as {
    channelDefinition?: ChannelDescriptor
  } | undefined
  return mod?.channelDefinition
}

const runAdapterValidators = (
  adapters: unknown,
  entries: readonly ResolvedAdapterSchemaEntry[]
) => {
  if (adapters == null || typeof adapters !== 'object') return []

  const adapterRecord = adapters as Record<string, unknown>
  return entries.flatMap((entry) => {
    const validator = entry.contribution.validate
    if (validator == null) return []

    const value = adapterRecord[entry.configKey]
    if (value == null) return []

    const parsed = entry.contribution.schema.safeParse(value)
    if (!parsed.success) return []

    return [...(validator(parsed.data) ?? [])]
  })
}

const runKnownAdapterStrictValidators = (
  adapters: unknown,
  entries: readonly ResolvedAdapterSchemaEntry[]
) => {
  if (adapters == null || typeof adapters !== 'object') return []

  const adapterRecord = adapters as Record<string, unknown>
  return entries.flatMap((entry) => {
    const value = adapterRecord[entry.configKey]
    if (value == null) return []
    return collectKnownSchemaUnknownKeyIssues(
      composeAdapterEntryValidationSchema(entry.contribution),
      value,
      [entry.configKey]
    )
  })
}

const createIssueErrorResult = (issues: readonly z.ZodIssue[]) => ({
  success: false as const,
  error: new z.ZodError([...issues])
})

export const composeBaseConfigSchemaBundle = () =>
  createBundle(
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

  const adapterEntries = dedupeResolvedAdapterSchemaEntries((
    await Promise.all(
      Array.from(adapterSpecifiers).map(async (specifier) => {
        const contribution = await loadAdapterContribution(specifier, options.cwd)
        return contribution == null ? undefined : resolveAdapterSchemaEntry(specifier, contribution)
      })
    )
  ).filter((entry): entry is ResolvedAdapterSchemaEntry => entry != null))

  const channelDefinitions = (
    await Promise.all(
      Array.from(channelSpecifiers).map(async specifier => await loadChannelDefinition(specifier, options.cwd))
    )
  ).filter((definition): definition is ChannelDescriptor => definition != null)

  return createBundle(
    `file://${resolve(options.cwd, WORKSPACE_SCHEMA_RELATIVE_PATH)}`,
    adapterEntries,
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

  const normalizedConfig = parsed.data as Config
  const issues = [
    ...runAdapterValidators(normalizedConfig.adapters, bundle.adapterEntries),
    ...runKnownAdapterStrictValidators((value as Config | undefined)?.adapters, bundle.adapterEntries)
  ]

  if (issues.length === 0) {
    return parsed
  }

  return createIssueErrorResult(issues.map((issue) => {
    if ('code' in issue) {
      return issue as z.ZodIssue
    }
    return {
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: issue.path ?? []
    }
  }))
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

  const issues = [
    ...runAdapterValidators(parsed.data, bundle.adapterEntries),
    ...runKnownAdapterStrictValidators(value, bundle.adapterEntries)
  ]

  if (issues.length === 0) {
    return parsed
  }

  return createIssueErrorResult(issues.map((issue) => {
    if ('code' in issue) {
      return issue as z.ZodIssue
    }
    return {
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: issue.path ?? []
    }
  }))
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
