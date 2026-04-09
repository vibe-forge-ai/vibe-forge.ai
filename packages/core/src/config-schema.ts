/* eslint-disable max-lines -- central config schema registry */
import { z } from 'zod'

import type { ConfigUiField, ConfigUiFieldType, ConfigUiObjectSchema } from '@vibe-forge/types'

import { channelBaseSchema } from './channel'

export interface ConfigSemanticIssue {
  path?: string[]
  message: string
}

export interface AdapterConfigContribution<TSchema extends z.AnyZodObject = z.AnyZodObject> {
  adapterKey: string
  title?: string
  description?: string
  schema: TSchema
  uiSchema?: ConfigUiObjectSchema
  validate?: (value: z.infer<TSchema>) => readonly ConfigSemanticIssue[] | void
}

export const defineAdapterConfigContribution = <TSchema extends z.AnyZodObject>(
  contribution: AdapterConfigContribution<TSchema>
) => contribution

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema)
]))

export const effortLevelSchema = z.enum(['low', 'medium', 'high', 'max'])
export const languageCodeSchema = z.enum(['zh', 'en'])

export const adapterConfigCommonSchema = z.object({
  defaultModel: z.string().optional().describe('Default model override for this adapter'),
  includeModels: z.array(z.string()).optional().describe('Allowed model IDs for this adapter'),
  excludeModels: z.array(z.string()).optional().describe('Blocked model IDs for this adapter')
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

export const conversationConfigSchema = z.object({
  style: z.enum(['friendly', 'programmatic']).optional().describe('Conversation style'),
  customInstructions: z.string().optional().describe('Extra system instructions'),
  injectDefaultSystemPrompt: z.boolean().optional().describe('Inject the default system prompt')
})

const pluginInstanceConfigSchema: z.ZodType<unknown> = z.lazy(() => z.object({
  id: z.string().min(1).describe('Plugin package name or short id'),
  enabled: z.boolean().optional().describe('Disable this plugin instance'),
  scope: z.string().optional().describe('User-defined plugin scope'),
  options: z.record(z.string(), jsonValueSchema).optional().describe('Plugin instance options'),
  children: z.array(pluginInstanceConfigSchema).optional().describe('Nested child plugin overrides')
}))

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

export const marketplaceConfigSchema = z.record(z.string(), z.object({
  type: z.literal('claude-code'),
  enabled: z.boolean().optional(),
  options: z.object({
    source: marketplaceSourceSchema
  }).optional()
}))

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
  notifications: notificationConfigSchema.optional()
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
  conversation: conversationConfigSchema.optional(),
  plugins: pluginConfigSchema.optional(),
  marketplaces: marketplaceConfigSchema.optional()
}).strict()

const unwrapUiSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (schema instanceof z.ZodOptional) return unwrapUiSchema(schema.unwrap())
  if (schema instanceof z.ZodNullable) return unwrapUiSchema(schema.unwrap())
  if (schema instanceof z.ZodDefault) return unwrapUiSchema(schema.removeDefault())
  if (schema instanceof z.ZodEffects) return unwrapUiSchema(schema.innerType())
  return schema
}

const getUiDefaultValue = (schema: z.ZodTypeAny): unknown => {
  if (schema instanceof z.ZodDefault) return schema._def.defaultValue()
  if (schema instanceof z.ZodOptional) return undefined
  if (schema instanceof z.ZodNullable) return null

  const unwrapped = unwrapUiSchema(schema)
  if (unwrapped instanceof z.ZodLiteral) return unwrapped.value
  if (unwrapped instanceof z.ZodEnum) return unwrapped.options[0]
  if (unwrapped instanceof z.ZodNativeEnum) {
    const values = Object.values(unwrapped.enum)
    return values.length > 0 ? values[0] : undefined
  }
  if (unwrapped instanceof z.ZodString) return ''
  if (unwrapped instanceof z.ZodNumber) return 0
  if (unwrapped instanceof z.ZodBoolean) return false
  if (unwrapped instanceof z.ZodArray) return []
  if (unwrapped instanceof z.ZodObject || unwrapped instanceof z.ZodRecord) return {}
  return undefined
}

const inferUiFieldType = (schema: z.ZodTypeAny): ConfigUiFieldType => {
  const unwrapped = unwrapUiSchema(schema)
  if (unwrapped instanceof z.ZodString) return 'string'
  if (unwrapped instanceof z.ZodNumber) return 'number'
  if (unwrapped instanceof z.ZodBoolean) return 'boolean'
  if (unwrapped instanceof z.ZodEnum || unwrapped instanceof z.ZodNativeEnum || unwrapped instanceof z.ZodLiteral) {
    return 'select'
  }
  if (unwrapped instanceof z.ZodArray) {
    const element = unwrapUiSchema(unwrapped.element)
    return element instanceof z.ZodString ? 'string[]' : 'json'
  }
  return 'json'
}

const inferUiOptions = (schema: z.ZodTypeAny) => {
  const unwrapped = unwrapUiSchema(schema)
  if (unwrapped instanceof z.ZodLiteral) {
    return [{ value: String(unwrapped.value) }]
  }
  if (unwrapped instanceof z.ZodEnum) {
    return unwrapped.options.map((value: string) => ({ value }))
  }
  if (unwrapped instanceof z.ZodNativeEnum) {
    return Object.values(unwrapped.enum).map(value => ({ value: String(value) }))
  }
  return undefined
}

export const buildConfigUiObjectSchema = (schema: z.ZodTypeAny): ConfigUiObjectSchema => {
  const unwrapped = unwrapUiSchema(schema)
  if (!(unwrapped instanceof z.ZodObject)) {
    return { fields: [] }
  }

  const shapeEntries = Object.entries(unwrapped.shape) as Array<[string, z.ZodTypeAny]>
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

  return { fields }
}
