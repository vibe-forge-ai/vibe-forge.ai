/* eslint-disable max-lines -- central config schema registry */
import { z } from 'zod'

import type {
  ConfigUiField,
  ConfigUiFieldType,
  ConfigUiObjectSchema,
  ConfigUiRecordFieldSchema
} from '@vibe-forge/types'

import { channelBaseSchema } from './channel'

export interface ConfigSemanticIssue {
  path?: string[]
  message: string
}

type AdapterConfigSchemaKey<TSchema extends z.AnyZodObject> = Extract<keyof z.infer<TSchema>, string>

export interface AdapterConfigEntryMetadata<
  TSchema extends z.AnyZodObject = z.AnyZodObject,
  TExtraCommonKey extends AdapterConfigSchemaKey<TSchema> = never,
> {
  extraCommonKeys?: readonly TExtraCommonKey[]
  deepMergeKeys?: readonly AdapterConfigSchemaKey<TSchema>[]
}

export interface AdapterConfigContribution<
  TSchema extends z.AnyZodObject = z.AnyZodObject,
  TExtraCommonKey extends AdapterConfigSchemaKey<TSchema> = never,
> {
  adapterKey: string
  title?: string
  description?: string
  schema: TSchema
  uiSchema?: ConfigUiObjectSchema
  configEntry?: AdapterConfigEntryMetadata<TSchema, TExtraCommonKey>
  validate?: (value: z.infer<TSchema>) => readonly ConfigSemanticIssue[] | void
}

export const defineAdapterConfigContribution = <
  TSchema extends z.AnyZodObject,
  TExtraCommonKey extends AdapterConfigSchemaKey<TSchema> = never,
>(
  contribution: AdapterConfigContribution<TSchema, TExtraCommonKey>
) => contribution

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
)

export const effortLevelSchema = z.enum(['low', 'medium', 'high', 'max'])
export const languageCodeSchema = z.enum(['zh', 'en'])

export const adapterAccountConfigCommonSchema = z.object({
  title: z.string().optional().describe('Display title'),
  description: z.string().optional().describe('Display description')
})

export const adapterConfigCommonSchema = z.object({
  defaultModel: z.string().optional().describe('Default model override for this adapter'),
  includeModels: z.array(z.string()).optional().describe('Allowed model IDs for this adapter'),
  excludeModels: z.array(z.string()).optional().describe('Blocked model IDs for this adapter'),
  defaultAccount: z.string().optional().describe('Default account override for this adapter'),
  accounts: z.record(z.string(), adapterAccountConfigCommonSchema).optional()
    .describe('Adapter account display metadata')
})

export const adapterNativeCliConfigSchema = z.object({
  source: z.enum(['managed', 'system', 'path']).optional().describe('Native CLI source'),
  path: z.string().optional().describe('Native CLI binary path when source is path'),
  package: z.string().optional().describe('Managed npm package name'),
  version: z.string().optional().describe('Managed npm package version'),
  autoInstall: z.boolean().optional().describe('Install the managed CLI when no usable binary is found'),
  prepareOnInstall: z.boolean().optional().describe('Preinstall this managed CLI during Vibe Forge package install'),
  npmPath: z.string().optional().describe('npm binary used for managed installs')
})

export const modelServiceConfigSchema = z.object({
  title: z.string().optional().describe('Display title'),
  description: z.string().optional().describe('Display description'),
  apiBaseUrl: z.string().min(1).describe('Provider API base URL'),
  apiKey: z.string().min(1).describe('Provider API key'),
  models: z.array(z.string()).optional().describe('Supported model IDs'),
  timeoutMs: z.number().int().positive().optional().describe('Request timeout in milliseconds'),
  maxOutputTokens: z.number().int().positive().optional().describe('Default max output tokens'),
  extra: z.record(z.string(), jsonValueSchema).optional().describe('Provider-specific extra config')
})

export const recommendedModelConfigSchema = z.object({
  service: z.string().optional().describe('Model service key'),
  model: z.string().min(1).describe('Model ID'),
  title: z.string().optional().describe('Display title'),
  description: z.string().optional().describe('Display description'),
  placement: z.enum(['modelSelector']).optional().describe('UI placement')
})

export const modelMetadataConfigSchema = z.object({
  alias: z.union([z.string(), z.array(z.string())]).optional().describe('Model aliases'),
  title: z.string().optional().describe('Display title'),
  description: z.string().optional().describe('Display description'),
  defaultAdapter: z.string().optional().describe('Preferred adapter key'),
  effort: effortLevelSchema.optional().describe('Recommended effort level')
})

export const notificationEventConfigSchema = z.object({
  title: z.string().optional().describe('Notification title override'),
  description: z.string().optional().describe('Notification description override'),
  disabled: z.boolean().optional().describe('Disable this notification event'),
  sound: z.string().optional().describe('Custom sound asset')
})

export const notificationConfigSchema = z.object({
  disabled: z.boolean().optional().describe('Disable notifications'),
  volume: z.number().min(0).max(100).optional().describe('Notification volume'),
  events: z.object({
    completed: notificationEventConfigSchema.optional(),
    failed: notificationEventConfigSchema.optional(),
    terminated: notificationEventConfigSchema.optional(),
    waiting_input: notificationEventConfigSchema.optional()
  }).optional().describe('Per-event notification overrides')
})

export const permissionsConfigSchema = z.object({
  allow: z.array(z.string()).optional().describe('Allowed tools'),
  deny: z.array(z.string()).optional().describe('Denied tools'),
  ask: z.array(z.string()).optional().describe('Tools that always ask'),
  defaultMode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']).optional()
    .describe('Default permission mode')
})

export const shortcutsConfigSchema = z.object({
  newSession: z.string().optional().describe('Shortcut for creating a new session'),
  openConfig: z.string().optional().describe('Shortcut for opening config'),
  sendMessage: z.string().optional().describe('Shortcut for sending a message'),
  clearInput: z.string().optional().describe('Shortcut for clearing the composer'),
  switchModel: z.string().optional().describe('Shortcut for switching models'),
  switchEffort: z.string().optional().describe('Shortcut for switching effort'),
  switchPermissionMode: z.string().optional().describe('Shortcut for switching permission mode')
})

export const conversationStarterModeSchema = z.enum([
  'default',
  'workspace',
  'entity',
  'agent',
  'spec'
])

export const conversationStarterWorktreeConfigSchema = z.object({
  create: z.boolean().optional().describe('Override whether the session uses a managed worktree'),
  environment: z.string().optional().describe('Managed worktree environment override'),
  branch: z.object({
    name: z.string().min(1).describe('Branch name'),
    kind: z.enum(['local', 'remote']).optional().describe('Branch kind'),
    mode: z.enum(['checkout', 'create']).optional().describe('Branch operation mode')
  }).optional().describe('Branch selection override')
})

export const conversationStarterConfigSchema = z.object({
  id: z.string().optional().describe('Stable starter identifier'),
  title: z.string().min(1).describe('Starter title'),
  description: z.string().optional().describe('Starter description'),
  icon: z.string().optional().describe('Material Symbols icon name'),
  mode: conversationStarterModeSchema.optional().describe('Target mode, `agent` is an alias for `entity`'),
  target: z.string().optional().describe('Target resource name or workspace id'),
  targetLabel: z.string().optional().describe('Optional target label shown in the UI'),
  targetDescription: z.string().optional().describe('Optional target description shown in the UI'),
  model: z.string().optional().describe('Model id or service-prefixed model value'),
  adapter: z.string().optional().describe('Adapter override'),
  account: z.string().optional().describe('Account override'),
  effort: z.union([z.literal('default'), effortLevelSchema]).optional().describe('Effort override'),
  permissionMode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']).optional()
    .describe('Permission mode override'),
  worktree: conversationStarterWorktreeConfigSchema.optional().describe('Managed worktree overrides'),
  prompt: z.string().optional().describe('Prefilled prompt'),
  files: z.array(z.string()).optional().describe('Referenced file paths'),
  rules: z.array(z.string()).optional().describe('Referenced rule paths or rule identifiers'),
  skills: z.array(z.string()).optional().describe('Referenced skill paths or skill identifiers')
})

export const conversationConfigSchema = z.object({
  style: z.enum(['friendly', 'programmatic']).optional().describe('Conversation style'),
  customInstructions: z.string().optional().describe('Extra system instructions'),
  injectDefaultSystemPrompt: z.boolean().optional().describe('Inject the default system prompt'),
  createSessionWorktree: z.boolean().optional().describe('Create a managed worktree for new sessions by default'),
  worktreeEnvironment: z.string().optional().describe('Default managed worktree environment'),
  startupPresets: z.array(conversationStarterConfigSchema).optional()
    .describe('Quick-start presets shown on the new session page'),
  builtinActions: z.array(conversationStarterConfigSchema).optional()
    .describe('Built-in development actions shown on the new session page')
})

export const webAuthAccountConfigSchema = z.object({
  username: z.string().min(1).describe('Login username'),
  password: z.string().min(1).describe('Login password')
})

export const webAuthConfigSchema = z.object({
  enabled: z.boolean().optional().describe('Enable Web UI login protection'),
  username: z.string().optional().describe('Fallback single-account username'),
  password: z.string().optional().describe('Fallback single-account password'),
  accounts: z.array(webAuthAccountConfigSchema).optional().describe('Allowed Web UI login accounts'),
  sessionTtlHours: z.number().positive().optional().describe('Browser session token lifetime in hours'),
  rememberDeviceTtlDays: z.number().positive().optional().describe('Remember-device token lifetime in days')
})

export const skillsCliConfigSchema = adapterNativeCliConfigSchema.extend({
  registry: z.string().optional().describe('Package registry used to install the managed skills CLI'),
  npmRegistry: z.string().optional().describe('Deprecated alias for skillsCli.registry'),
  env: z.record(z.string(), z.string()).optional().describe('Environment variables passed to the skills CLI')
})

export const skillHomeBridgeConfigSchema = z.object({
  enabled: z.boolean().optional().describe('Bridge supported home skill roots into workspace asset discovery'),
  roots: z.union([z.string(), z.array(z.string())]).optional()
    .describe('Ordered home skill roots. Supports absolute paths or paths starting with ~')
})

export const configuredSkillInstallConfigSchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1).describe('Remote skill name'),
    source: z.string().optional().describe('Remote skills CLI source path'),
    rename: z.string().optional().describe('Local skill name to expose after install')
  })
])

export const legacySkillsConfigSchema = z.object({
  install: z.array(configuredSkillInstallConfigSchema).optional()
    .describe('Project skills that should be ensured before session startup'),
  cli: skillsCliConfigSchema.optional().describe('Deprecated alias for top-level skillsCli runtime settings'),
  homeBridge: skillHomeBridgeConfigSchema.optional().describe('Home skill auto-bridge settings')
})

export const skillsConfigSchema = z.union([
  z.array(configuredSkillInstallConfigSchema)
    .describe('Project skills that should be ensured before session startup'),
  legacySkillsConfigSchema
])

const pluginInstanceConfigSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1).describe('Plugin package name or short id'),
    enabled: z.boolean().optional().describe('Disable this plugin instance'),
    scope: z.string().optional().describe('User-defined plugin scope'),
    options: z.record(z.string(), jsonValueSchema).optional().describe('Plugin instance options'),
    children: z.array(pluginInstanceConfigSchema).optional().describe('Nested child plugin overrides')
  })
)

export const pluginConfigSchema = z.array(pluginInstanceConfigSchema).describe('Plugin instance list')

const marketplacePluginSourceSchema = z.union([
  z.string().min(1),
  z.object({
    source: z.literal('github'),
    repo: z.string().min(1),
    ref: z.string().optional(),
    sha: z.string().optional()
  }),
  z.object({
    source: z.literal('url'),
    url: z.string().min(1),
    ref: z.string().optional(),
    sha: z.string().optional()
  }),
  z.object({
    source: z.literal('git-subdir'),
    url: z.string().min(1),
    path: z.string().min(1),
    ref: z.string().optional(),
    sha: z.string().optional()
  }),
  z.object({
    source: z.literal('npm'),
    package: z.string().min(1),
    version: z.string().optional(),
    registry: z.string().optional()
  })
])

const marketplacePluginDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  strict: z.boolean().optional(),
  skills: z.union([z.string(), z.array(z.string())]).optional(),
  commands: z.union([z.string(), z.array(z.string())]).optional(),
  agents: z.union([z.string(), z.array(z.string())]).optional(),
  hooks: z.union([z.string(), z.array(z.string()), z.record(z.string(), jsonValueSchema)]).optional(),
  mcpServers: z.union([z.string(), z.array(z.string()), z.record(z.string(), jsonValueSchema)]).optional(),
  userConfig: jsonValueSchema.optional(),
  source: marketplacePluginSourceSchema
})

const marketplaceSourceSchema = z.union([
  z.object({
    source: z.literal('github'),
    repo: z.string().min(1),
    ref: z.string().optional(),
    path: z.string().optional()
  }),
  z.object({
    source: z.literal('git'),
    url: z.string().min(1),
    ref: z.string().optional(),
    path: z.string().optional()
  }),
  z.object({
    source: z.literal('directory'),
    path: z.string().min(1)
  }),
  z.object({
    source: z.literal('url'),
    url: z.string().min(1)
  }),
  z.object({
    source: z.literal('settings'),
    name: z.string().optional(),
    metadata: z.object({
      pluginRoot: z.string().optional()
    }).optional(),
    plugins: z.array(marketplacePluginDefinitionSchema)
  }),
  z.object({
    source: z.literal('hostPattern'),
    hostPattern: z.string().min(1)
  })
])

const marketplaceDeclaredPluginConfigSchema = z.union([
  z.boolean().transform(enabled => ({ enabled })),
  z.object({
    enabled: z.boolean().optional(),
    scope: z.string().optional()
  })
])

export const marketplaceConfigSchema = z.record(
  z.string(),
  z.object({
    type: z.literal('claude-code'),
    enabled: z.boolean().optional(),
    syncOnRun: z.boolean().optional(),
    plugins: z.record(z.string(), marketplaceDeclaredPluginConfigSchema).optional(),
    options: z.object({
      source: marketplaceSourceSchema
    }).optional()
  })
)

const mcpServerCommonSchema = z.object({
  enabled: z.boolean().optional().describe('Enable this MCP server'),
  env: z.record(z.string(), z.string()).optional().describe('Environment variables')
})

const mcpServerCommandSchema = mcpServerCommonSchema.extend({
  command: z.string().min(1).describe('Executable command'),
  args: z.array(z.string()).optional().describe('Command arguments')
})

const mcpServerSseSchema = mcpServerCommonSchema.extend({
  type: z.literal('sse'),
  url: z.string().min(1).describe('SSE endpoint URL'),
  headers: z.record(z.string(), z.string()).describe('HTTP headers')
})

const mcpServerHttpSchema = mcpServerCommonSchema.extend({
  type: z.literal('http'),
  url: z.string().min(1).describe('HTTP endpoint URL'),
  headers: z.record(z.string(), z.string()).optional().describe('HTTP headers')
})

export const mcpServerConfigSchema = z.union([
  mcpServerCommandSchema,
  mcpServerSseSchema,
  mcpServerHttpSchema
])

export const generalConfigSectionSchema = z.object({
  baseDir: z.string().optional(),
  effort: effortLevelSchema.optional(),
  defaultAdapter: z.string().optional(),
  defaultModelService: z.string().optional(),
  defaultModel: z.string().optional(),
  recommendedModels: z.array(recommendedModelConfigSchema).optional(),
  interfaceLanguage: languageCodeSchema.optional(),
  modelLanguage: languageCodeSchema.optional(),
  announcements: z.array(z.string()).optional(),
  permissions: permissionsConfigSchema.optional(),
  env: z.record(z.string(), z.string()).optional(),
  notifications: notificationConfigSchema.optional(),
  skills: skillsConfigSchema.optional(),
  skillsCli: skillsCliConfigSchema.optional(),
  webAuth: webAuthConfigSchema.optional()
})

export const pluginSectionSchema = z.object({
  plugins: pluginConfigSchema.optional(),
  marketplaces: marketplaceConfigSchema.optional()
})

export const mcpConfigSectionSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerConfigSchema).optional(),
  defaultIncludeMcpServers: z.array(z.string()).optional(),
  defaultExcludeMcpServers: z.array(z.string()).optional(),
  noDefaultVibeForgeMcpServer: z.boolean().optional()
})

export const baseAdapterEntrySchema = adapterConfigCommonSchema.passthrough()
export const baseChannelEntrySchema = channelBaseSchema.passthrough()

export const configSectionSchemas = {
  general: generalConfigSectionSchema,
  conversation: conversationConfigSchema,
  models: z.record(z.string(), modelMetadataConfigSchema),
  modelServices: z.record(z.string(), modelServiceConfigSchema),
  channels: z.record(z.string(), baseChannelEntrySchema),
  adapters: z.object({}).catchall(baseAdapterEntrySchema),
  plugins: pluginSectionSchema,
  mcp: mcpConfigSectionSchema,
  auth: webAuthConfigSchema,
  shortcuts: shortcutsConfigSchema
} as const

export const baseConfigFileSchema = z.object({
  $schema: z.string().optional().describe('JSON Schema URL'),
  extend: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
  baseDir: z.string().optional(),
  effort: effortLevelSchema.optional(),
  adapters: z.object({}).catchall(baseAdapterEntrySchema).optional(),
  models: z.record(z.string(), modelMetadataConfigSchema).optional(),
  defaultAdapter: z.string().optional(),
  modelServices: z.record(z.string(), modelServiceConfigSchema).optional(),
  channels: z.record(z.string(), baseChannelEntrySchema).optional(),
  defaultModelService: z.string().optional(),
  defaultModel: z.string().optional(),
  recommendedModels: z.array(recommendedModelConfigSchema).optional(),
  interfaceLanguage: languageCodeSchema.optional(),
  modelLanguage: languageCodeSchema.optional(),
  mcpServers: z.record(z.string(), mcpServerConfigSchema).optional(),
  defaultIncludeMcpServers: z.array(z.string()).optional(),
  defaultExcludeMcpServers: z.array(z.string()).optional(),
  noDefaultVibeForgeMcpServer: z.boolean().optional(),
  permissions: permissionsConfigSchema.optional(),
  env: z.record(z.string(), z.string()).optional(),
  announcements: z.array(z.string()).optional(),
  shortcuts: shortcutsConfigSchema.optional(),
  notifications: notificationConfigSchema.optional(),
  skills: skillsConfigSchema.optional(),
  skillsCli: skillsCliConfigSchema.optional(),
  webAuth: webAuthConfigSchema.optional(),
  conversation: conversationConfigSchema.optional(),
  plugins: pluginConfigSchema.optional(),
  marketplaces: marketplaceConfigSchema.optional()
}).strict()

const getZodTypeName = (schema: z.ZodTypeAny) => (
  (schema as { _def?: { typeName?: string } })._def?.typeName
)

const isZodType = (schema: z.ZodTypeAny, typeName: string) => getZodTypeName(schema) === typeName

const unwrapUiSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (isZodType(schema, 'ZodOptional') || isZodType(schema, 'ZodNullable')) {
    return unwrapUiSchema((schema as unknown as { unwrap: () => z.ZodTypeAny }).unwrap())
  }
  if (isZodType(schema, 'ZodDefault')) {
    return unwrapUiSchema((schema as unknown as { removeDefault: () => z.ZodTypeAny }).removeDefault())
  }
  if (isZodType(schema, 'ZodEffects')) {
    return unwrapUiSchema((schema as unknown as { innerType: () => z.ZodTypeAny }).innerType())
  }
  return schema
}

const getUiDefaultValue = (schema: z.ZodTypeAny): unknown => {
  if (isZodType(schema, 'ZodDefault')) {
    return (schema as unknown as { _def: { defaultValue: () => unknown } })._def.defaultValue()
  }
  if (isZodType(schema, 'ZodOptional')) return undefined
  if (isZodType(schema, 'ZodNullable')) return null

  const unwrapped = unwrapUiSchema(schema)
  if (isZodType(unwrapped, 'ZodLiteral')) return (unwrapped as unknown as { value: unknown }).value
  if (isZodType(unwrapped, 'ZodEnum')) return (unwrapped as unknown as { options: string[] }).options[0]
  if (isZodType(unwrapped, 'ZodNativeEnum')) {
    const values = Object.values((unwrapped as unknown as { enum: Record<string, unknown> }).enum)
    return values.length > 0 ? values[0] : undefined
  }
  if (isZodType(unwrapped, 'ZodString')) return ''
  if (isZodType(unwrapped, 'ZodNumber')) return 0
  if (isZodType(unwrapped, 'ZodBoolean')) return false
  if (isZodType(unwrapped, 'ZodArray')) return []
  if (isZodType(unwrapped, 'ZodObject') || isZodType(unwrapped, 'ZodRecord')) return {}
  return undefined
}

const inferUiFieldType = (schema: z.ZodTypeAny): ConfigUiFieldType => {
  const unwrapped = unwrapUiSchema(schema)
  if (isZodType(unwrapped, 'ZodString')) return 'string'
  if (isZodType(unwrapped, 'ZodNumber')) return 'number'
  if (isZodType(unwrapped, 'ZodBoolean')) return 'boolean'
  if (
    isZodType(unwrapped, 'ZodEnum') ||
    isZodType(unwrapped, 'ZodNativeEnum') ||
    isZodType(unwrapped, 'ZodLiteral')
  ) {
    return 'select'
  }
  if (isZodType(unwrapped, 'ZodArray')) {
    const element = unwrapUiSchema((unwrapped as unknown as { element: z.ZodTypeAny }).element)
    return isZodType(element, 'ZodString') ? 'string[]' : 'json'
  }
  return 'json'
}

const inferUiOptions = (schema: z.ZodTypeAny) => {
  const unwrapped = unwrapUiSchema(schema)
  if (isZodType(unwrapped, 'ZodLiteral')) {
    return [{ value: String((unwrapped as unknown as { value: unknown }).value) }]
  }
  if (isZodType(unwrapped, 'ZodEnum')) {
    return (unwrapped as unknown as { options: string[] }).options.map(value => ({ value }))
  }
  if (isZodType(unwrapped, 'ZodNativeEnum')) {
    return Object.values((unwrapped as unknown as { enum: Record<string, string | number> }).enum)
      .map(value => ({ value: String(value) }))
  }
  return undefined
}

export const buildConfigUiObjectSchema = (schema: z.ZodTypeAny): ConfigUiObjectSchema => {
  const unwrapped = unwrapUiSchema(schema)
  if (!isZodType(unwrapped, 'ZodObject')) {
    return { fields: [] }
  }

  const shapeEntries = Object.entries((unwrapped as unknown as { shape: Record<string, z.ZodTypeAny> }).shape) as Array<
    [string, z.ZodTypeAny]
  >
  const fields = shapeEntries.map(([key, value]) => {
    const uiField: ConfigUiField = {
      path: [key],
      type: inferUiFieldType(value),
      defaultValue: getUiDefaultValue(value),
      description: unwrapUiSchema(value).description,
      options: inferUiOptions(value)
    }
    return uiField
  })

  const recordFields = Object.fromEntries(
    shapeEntries.flatMap(([key, value]): Array<[string, ConfigUiRecordFieldSchema]> => {
      const recordSchema = unwrapUiSchema(value)
      if (!isZodType(recordSchema, 'ZodRecord')) {
        return []
      }

      const itemSchema = (recordSchema as unknown as { _def: { valueType: z.ZodTypeAny } })._def.valueType
      const itemObjectSchema = buildConfigUiObjectSchema(itemSchema)
      if ((itemObjectSchema.fields.length === 0) && itemObjectSchema.recordFields == null) {
        return []
      }

      return [[key, {
        itemSchema: itemObjectSchema
      }]]
    })
  )

  return {
    fields,
    ...(Object.keys(recordFields).length > 0 ? { recordFields } : {})
  }
}
