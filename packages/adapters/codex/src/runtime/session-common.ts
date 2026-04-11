import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'
import type { AdapterCtx, AdapterQueryOptions, ModelServiceConfig } from '@vibe-forge/types'
import { buildNativeModelCatalog, resolveBuiltinPassthroughRoutes, resolveServiceRoutes } from '@vibe-forge/utils'
import type { NativeModelCatalog } from '@vibe-forge/utils'
import { createLogger } from '@vibe-forge/utils/create-logger'

import { builtinModels } from '#~/models.js'
import { resolveCodexBinaryPath } from '#~/paths.js'
import { CodexRpcError } from '#~/protocol/rpc.js'
import type { CodexInputItem, CodexSandboxPolicy } from '#~/types.js'
import {
  CODEX_PROXY_META_HEADER_NAME,
  CODEX_PROXY_SESSION_HEADER_NAME,
  encodeCodexProxyMeta,
  ensureCodexProxyServer,
  registerProxyCatalog
} from './proxy'
import { createCodexProxyCatalog } from './proxy-catalog'
import type { CodexProxyCatalog } from './proxy-catalog'

export type CodexApprovalPolicy = 'never' | 'unlessTrusted' | 'onRequest'
export type CodexOutboundApprovalPolicy = 'never' | 'untrusted' | 'on-request'
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

/**
 * Map a single vibe-forge `AdapterMessageContent` item to zero or one Codex input items.
 */
function mapSingleContentToCodexInput(
  item: { type: string; text?: string; url?: string; path?: string; [k: string]: unknown }
): CodexInputItem | null {
  if (item.type === 'text' && typeof item.text === 'string') {
    return { type: 'text', text: item.text }
  }
  if (item.type === 'image' && typeof item.url === 'string') {
    // data: URIs are not supported as inline image inputs by Codex app-server
    if (item.url.startsWith('data:')) {
      return { type: 'text', text: '[Image: base64 data not supported inline]' }
    }
    return { type: 'image', url: item.url }
  }
  if (item.type === 'file' && typeof item.path === 'string' && item.path.trim() !== '') {
    return { type: 'text', text: `Context file: ${item.path}` }
  }
  return null
}

function buildSpawnEnv(env: AdapterCtx['env']): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...Object.fromEntries(
      Object.entries(env).filter((entry): entry is [string, string] => entry[1] != null)
    )
  }
}

function resolveApprovalPolicy(permissionMode: AdapterQueryOptions['permissionMode']): CodexApprovalPolicy {
  if (permissionMode === 'bypassPermissions' || permissionMode === 'dontAsk') return 'never'
  if (permissionMode === 'plan') return 'onRequest'
  return 'unlessTrusted'
}

function shouldUseYolo(permissionMode: AdapterQueryOptions['permissionMode']) {
  return permissionMode === 'bypassPermissions'
}

export function toCodexOutboundApprovalPolicy(
  approvalPolicy: CodexApprovalPolicy
): CodexOutboundApprovalPolicy {
  return approvalPolicy === 'unlessTrusted'
    ? 'untrusted'
    : approvalPolicy === 'onRequest'
    ? 'on-request'
    : 'never'
}

/**
 * Encode a string value as a TOML inline string (JSON encoding is a valid subset).
 */
const toToml = (value: string) => JSON.stringify(value)

interface CodexModelProviderExtra {
  wireApi?: string
  queryParams?: Record<string, string>
  headers?: Record<string, string>
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const normalizeStringRecord = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

const normalizePositiveInteger = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined
)

const normalizeCodexReasoningEffort = (value: unknown): CodexReasoningEffort | undefined => (
  value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh'
    ? value
    : undefined
)

const mapPublicEffortToCodex = (value: AdapterQueryOptions['effort']): CodexReasoningEffort | undefined => (
  value === 'max'
    ? 'xhigh'
    : value === 'low' || value === 'medium' || value === 'high'
    ? value
    : undefined
)

const resolveCodexHomeDir = (env?: AdapterCtx['env']) => {
  const candidate = env?.HOME ?? process.env.HOME ?? homedir()
  if (typeof candidate === 'string' && candidate.trim() !== '') {
    return candidate
  }

  throw new Error('Failed to resolve Codex home directory')
}

const mapCodexEffortToPublic = (value: CodexReasoningEffort | undefined): AdapterQueryOptions['effort'] => (
  value === 'xhigh' ? 'max' : value
)

const resolveRoutedServiceKey = (rawModel: string | undefined) => {
  const normalizedRawModel = rawModel?.trim()
  if (normalizedRawModel == null || !normalizedRawModel.includes(',')) return undefined
  const commaIdx = normalizedRawModel.indexOf(',')
  return normalizedRawModel.slice(0, commaIdx).trim() || undefined
}

const normalizeProviderBaseUrl = (apiBaseUrl: string | undefined, wireApi: string | undefined) => {
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl.trim() === '') return undefined
  return (wireApi ?? 'responses') === 'responses' && apiBaseUrl.endsWith('/responses')
    ? apiBaseUrl.slice(0, -'/responses'.length)
    : apiBaseUrl
}

const DEFAULT_CODEX_CONFIG_OVERRIDES: Record<string, unknown> = {
  check_for_update_on_startup: false
}

/**
 * Encode a flat string→string record as a TOML inline table: `{key = "value", …}`.
 */
const toTomlInlineTable = (obj: Record<string, string>) =>
  `{${Object.entries(obj).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ')}}`

const MCP_INHERITED_ENV_KEYS = [
  '__VF_PROJECT_WORKSPACE_FOLDER__',
  '__VF_PROJECT_PACKAGE_DIR__',
  '__VF_PROJECT_CLI_PACKAGE_DIR__',
  '__VF_PROJECT_AI_SESSION_ID__',
  '__VF_PROJECT_AI_CTX_ID__',
  '__VF_PROJECT_AI_RUN_TYPE__',
  '__VF_PROJECT_AI_SERVER_HOST__',
  '__VF_PROJECT_AI_SERVER_PORT__',
  '__VF_PROJECT_AI_LOG_PREFIX__'
] as const

const pickInheritedMcpEnv = (env: Record<string, string | null | undefined>) => (
  Object.fromEntries(
    MCP_INHERITED_ENV_KEYS
      .map(key => [key, env[key]])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
  )
)

const encodeCodexConfigValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return toToml(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
      return JSON.stringify(value)
    }
    return undefined
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter((entry) =>
      typeof entry[1] === 'string' || typeof entry[1] === 'number' || typeof entry[1] === 'boolean'
    )
    if (entries.length === 0 || entries.length !== Object.keys(value).length) return undefined
    return `{${
      entries.map(([key, item]) => `${key} = ${typeof item === 'string' ? JSON.stringify(item) : String(item)}`).join(
        ', '
      )
    }}`
  }
  return undefined
}

const mergeCodexConfigOverrides = (overrides: Record<string, unknown>) => ({
  ...DEFAULT_CODEX_CONFIG_OVERRIDES,
  ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined))
})

const buildNativeConfigOverrideArgs = (overrides: Record<string, unknown>) => {
  const args: string[] = []
  for (const [key, value] of Object.entries(overrides)) {
    const encoded = encodeCodexConfigValue(value)
    if (encoded == null) continue
    args.push('-c', `${key}=${encoded}`)
  }
  return args
}

const DEFAULT_CATALOG_REASONING_LEVEL: CodexReasoningEffort = 'medium'

const DEFAULT_CATALOG_REASONING_LEVELS: Array<{
  effort: CodexReasoningEffort
  description: string
}> = [
  { effort: 'low', description: 'Fast responses with lighter reasoning' },
  { effort: 'medium', description: 'Balances speed and reasoning depth for everyday tasks' },
  { effort: 'high', description: 'Greater reasoning depth for complex problems' },
  { effort: 'xhigh', description: 'Extra high reasoning depth for complex problems' }
]

interface CodexCatalogModel {
  slug: string
  display_name: string
  description?: string
  base_instructions: string
  default_reasoning_level: CodexReasoningEffort
  supported_reasoning_levels: Array<{
    effort: CodexReasoningEffort
    description: string
  }>
  shell_type: string
  visibility: 'list' | 'hide'
  supported_in_api: boolean
  priority: number
  [key: string]: unknown
}

const projectCatalogModel = (value: unknown, index: number): CodexCatalogModel | undefined => {
  if (!isPlainObject(value)) return undefined

  const slug = typeof value.slug === 'string' && value.slug.trim() !== ''
    ? value.slug
    : undefined
  const displayName = typeof value.display_name === 'string' && value.display_name.trim() !== ''
    ? value.display_name
    : slug

  if (slug == null || displayName == null) return undefined

  const defaultReasoningLevel = normalizeCodexReasoningEffort(value.default_reasoning_level) ??
    DEFAULT_CATALOG_REASONING_LEVEL
  const supportedReasoningLevels = Array.isArray(value.supported_reasoning_levels)
    ? value.supported_reasoning_levels
      .flatMap((entry) => {
        if (!isPlainObject(entry)) return []
        const effort = normalizeCodexReasoningEffort(entry.effort)
        if (effort == null) return []
        return [{
          effort,
          description: typeof entry.description === 'string'
            ? entry.description
            : DEFAULT_CATALOG_REASONING_LEVELS.find(level => level.effort === effort)?.description ?? ''
        }]
      })
    : []

  return {
    ...value,
    slug,
    display_name: displayName,
    ...(typeof value.description === 'string' && value.description.trim() !== ''
      ? { description: value.description }
      : {}),
    base_instructions: typeof value.base_instructions === 'string' ? value.base_instructions : '',
    default_reasoning_level: defaultReasoningLevel,
    supported_reasoning_levels: supportedReasoningLevels.length > 0
      ? supportedReasoningLevels
      : DEFAULT_CATALOG_REASONING_LEVELS,
    shell_type: typeof value.shell_type === 'string' && value.shell_type.trim() !== ''
      ? value.shell_type
      : 'shell_command',
    visibility: value.visibility === 'hide' ? 'hide' : 'list',
    supported_in_api: typeof value.supported_in_api === 'boolean' ? value.supported_in_api : true,
    priority: normalizePositiveInteger(value.priority) ?? (index + 1)
  }
}

const buildCatalogModelFromRoute = (
  route: Parameters<typeof createCodexProxyCatalog>[0]['routes'][number],
  slug: string,
  priority: number,
  displayName?: string,
  template?: CodexCatalogModel
): CodexCatalogModel => ({
  ...(template ?? {
    additional_speed_tiers: [],
    availability_nux: null,
    upgrade: null,
    model_messages: {},
    supports_reasoning_summaries: false,
    default_reasoning_summary: 'none',
    support_verbosity: true,
    default_verbosity: 'low',
    apply_patch_tool_type: 'freeform',
    web_search_tool_type: 'text_and_image',
    truncation_policy: { mode: 'tokens', limit: 10_000 },
    supports_parallel_tool_calls: true,
    supports_image_detail_original: true,
    context_window: 128_000,
    effective_context_window_percent: 95,
    experimental_supported_tools: [],
    input_modalities: ['text'],
    supports_search_tool: true
  }),
  slug,
  display_name: displayName ?? route.title,
  ...(route.description != null && route.description.trim() !== ''
    ? { description: route.description }
    : {}),
  base_instructions: '',
  default_reasoning_level: DEFAULT_CATALOG_REASONING_LEVEL,
  supported_reasoning_levels: DEFAULT_CATALOG_REASONING_LEVELS,
  shell_type: 'shell_command',
  visibility: 'list',
  supported_in_api: true,
  priority
})

const resolveCatalogSlug = (
  route: Parameters<typeof createCodexProxyCatalog>[0]['routes'][number],
  usedSlugs: Set<string>
) => {
  const candidates = [route.upstreamModel, route.selectorValue, route.nativeModelId]
  const match = candidates.find(candidate =>
    typeof candidate === 'string' && candidate.trim() !== '' && !usedSlugs.has(candidate)
  )
  return match ?? route.nativeModelId
}

const buildCodexModelCatalog = async (params: {
  nativeCatalog: NativeModelCatalog
  homeDir: string
}) => {
  const modelsCachePath = resolve(params.homeDir, '.codex', 'models_cache.json')
  let baseModels: CodexCatalogModel[] = []

  try {
    const raw = await readFile(modelsCachePath, 'utf8')
    const parsed = JSON.parse(raw) as { models?: unknown[] }
    baseModels = Array.isArray(parsed.models)
      ? parsed.models.flatMap((model, index) => {
        const projected = projectCatalogModel(model, index)
        return projected != null ? [projected] : []
      })
      : []
  } catch {
    baseModels = []
  }

  const mergedModels = [...baseModels]
  const templateModel = mergedModels[0]
  const usedSlugs = new Set(mergedModels.map(model => model.slug))

  for (const route of params.nativeCatalog.routes) {
    const isBuiltin = route.kind === 'builtin_passthrough'
    const preferredSlug = isBuiltin ? route.upstreamModel : resolveCatalogSlug(route, usedSlugs)
    if (usedSlugs.has(preferredSlug)) continue

    const displayName = !isBuiltin && preferredSlug !== route.upstreamModel && route.serviceKey != null
      ? `${route.title} (${route.serviceKey})`
      : route.title

    mergedModels.push(buildCatalogModelFromRoute(route, preferredSlug, route.order + 1, displayName, templateModel))
    usedSlugs.add(preferredSlug)
  }

  mergedModels.sort((left, right) => left.priority - right.priority)
  return { models: mergedModels }
}

/**
 * Derive the `-c key=value` overrides and API-key env injections needed to map
 * vibe-forge `systemPrompt` and `modelServices` onto codex configuration.
 *
 * model format: plain `"gpt-4o"` — used as-is;
 *               `"service,model"` — routes through the named model service.
 */
function buildCodexConfigOverrides(params: {
  systemPrompt: string | undefined
  rawModel: string | undefined
  modelServices: Record<string, ModelServiceConfig>
  proxyBaseUrl?: string
  proxyLogContext?: {
    cwd: string
    ctxId: string
    sessionId: string
  }
  proxyDiagnostics?: {
    requestedModel?: string
    runtime?: string
    sessionType?: string
    permissionMode?: string
    approvalPolicy?: string
    sandboxPolicy?: string
    useYolo?: boolean
    requestedEffort?: string
    effectiveEffort?: string
  }
}): {
  args: string[]
  fingerprintArgs: string[]
  resolvedModel: string | undefined
  resolvedMaxOutputTokens: number | null | undefined
} {
  const {
    systemPrompt,
    rawModel,
    modelServices,
    proxyBaseUrl,
    proxyLogContext,
    proxyDiagnostics
  } = params
  const args: string[] = []
  const fingerprintArgs: string[] = []
  const normalizedRawModel = rawModel?.trim()
  const pushArgs = (value: string) => {
    args.push('-c', value)
  }
  const pushFingerprintArgs = (value: string) => {
    fingerprintArgs.push('-c', value)
  }
  const pushBoth = (value: string) => {
    pushArgs(value)
    pushFingerprintArgs(value)
  }

  if (systemPrompt) {
    pushBoth(`developer_instructions=${toToml(systemPrompt)}`)
  }

  let resolvedModel: string | undefined
  let resolvedMaxOutputTokens: number | null | undefined

  if (normalizedRawModel?.toLowerCase() === 'default') {
    resolvedModel = undefined
  } else if (normalizedRawModel?.includes(',')) {
    const commaIdx = normalizedRawModel.indexOf(',')
    const serviceKey = normalizedRawModel.slice(0, commaIdx).trim()
    const modelId = normalizedRawModel.slice(commaIdx + 1).trim()
    const service = modelServices[serviceKey]

    if (service) {
      const { title, apiBaseUrl, apiKey, extra, timeoutMs, maxOutputTokens } = service
      const { wireApi, queryParams, headers } = (extra?.codex as CodexModelProviderExtra | undefined) ?? {}
      const prefix = `model_providers.${serviceKey}`
      const normalizedBaseUrl = normalizeProviderBaseUrl(apiBaseUrl, wireApi)
      const normalizedHeaders = normalizeStringRecord(headers)
      const normalizedQueryParams = normalizeStringRecord(queryParams)
      const normalizedTimeoutMs = normalizePositiveInteger(timeoutMs)
      const normalizedMaxOutputTokens = normalizePositiveInteger(maxOutputTokens)
      const shouldProxyProvider = proxyBaseUrl != null && normalizedBaseUrl != null

      pushBoth(`model_provider=${toToml(serviceKey)}`)
      pushBoth(`${prefix}.name=${toToml(title ?? serviceKey)}`)
      if (shouldProxyProvider) {
        const proxyMeta = encodeCodexProxyMeta({
          upstreamBaseUrl: normalizedBaseUrl,
          ...(Object.keys(normalizedHeaders).length > 0 ? { headers: normalizedHeaders } : {}),
          ...(Object.keys(normalizedQueryParams).length > 0 ? { queryParams: normalizedQueryParams } : {}),
          ...(normalizedMaxOutputTokens != null ? { maxOutputTokens: normalizedMaxOutputTokens } : {}),
          ...(proxyLogContext != null ? { logContext: proxyLogContext } : {}),
          diagnostics: {
            ...proxyDiagnostics,
            routedServiceKey: serviceKey,
            resolvedModel: modelId || undefined,
            wireApi: wireApi ?? 'responses'
          }
        })
        pushArgs(`${prefix}.base_url=${toToml(proxyBaseUrl)}`)
        pushFingerprintArgs(`${prefix}.base_url=${toToml(normalizedBaseUrl)}`)
        pushBoth(
          `${prefix}.http_headers=${toTomlInlineTable({ [CODEX_PROXY_META_HEADER_NAME]: proxyMeta })}`
        )
      } else if (normalizedBaseUrl != null) {
        pushBoth(`${prefix}.base_url=${toToml(normalizedBaseUrl)}`)
      }
      if (apiKey) {
        pushBoth(`${prefix}.experimental_bearer_token=${toToml(apiKey)}`)
      }
      if (wireApi) {
        pushBoth(`${prefix}.wire_api=${toToml(wireApi)}`)
      }
      if (!shouldProxyProvider && Object.keys(normalizedHeaders).length > 0) {
        pushBoth(`${prefix}.http_headers=${toTomlInlineTable(normalizedHeaders)}`)
      }
      if (normalizedTimeoutMs != null) {
        pushBoth(`${prefix}.stream_idle_timeout_ms=${normalizedTimeoutMs}`)
      }
      resolvedMaxOutputTokens = shouldProxyProvider && normalizedMaxOutputTokens != null
        ? null
        : normalizedMaxOutputTokens
      if (!shouldProxyProvider && Object.keys(normalizedQueryParams).length > 0) {
        pushBoth(`${prefix}.query_params=${toTomlInlineTable(normalizedQueryParams)}`)
      }
    }

    resolvedModel = modelId || undefined
  } else {
    resolvedModel = normalizedRawModel || undefined
  }

  return { args, fingerprintArgs, resolvedModel, resolvedMaxOutputTokens }
}

/**
 * Build `-c mcp_servers.<name>.*` overrides for each filtered MCP server.
 */
function buildMcpConfigArgs(
  servers: Record<string, unknown>,
  inheritedEnv: Record<string, string | null | undefined> = {}
): string[] {
  const toTomlKey = (name: string) => /^[\w-]+$/.test(name) ? name : JSON.stringify(name)
  const args: string[] = []
  const inheritedMcpEnv = pickInheritedMcpEnv(inheritedEnv)
  for (const [name, server] of Object.entries(servers)) {
    const {
      command,
      args: cmdArgs,
      env,
      url,
      headers
    } = server as {
      command?: string
      args?: unknown[]
      env?: Record<string, string>
      url?: string
      headers?: Record<string, string>
    }
    const prefix = `mcp_servers.${toTomlKey(name)}`

    if (typeof command === 'string') {
      args.push('-c', `${prefix}.command=${toToml(command)}`)
      if (Array.isArray(cmdArgs) && cmdArgs.length > 0) {
        args.push('-c', `${prefix}.args=${JSON.stringify(cmdArgs)}`)
      }
      const mergedEnv = {
        ...inheritedMcpEnv,
        ...(env ?? {})
      }
      if (Object.keys(mergedEnv).length > 0) {
        args.push('-c', `${prefix}.env=${toTomlInlineTable(mergedEnv)}`)
      }
    } else if (typeof url === 'string') {
      args.push('-c', `${prefix}.url=${toToml(url)}`)
      if (headers != null && Object.keys(headers).length > 0) {
        args.push('-c', `${prefix}.http_headers=${toTomlInlineTable(headers)}`)
      }
    }
  }
  return args
}

/**
 * Build `--enable <name>` / `--disable <name>` args from a features map.
 */
export function buildFeatureArgs(features: Record<string, boolean>): string[] {
  const args: string[] = []
  for (const [name, enabled] of Object.entries(features)) {
    args.push(enabled ? '--enable' : '--disable', name)
  }
  return args
}

/**
 * Map an array of vibe-forge `AdapterMessageContent` to Codex `turn/start` input items.
 */
export function mapContentToCodexInput(
  content: Array<{ type: string; text?: string; url?: string; path?: string; [k: string]: unknown }>
): CodexInputItem[] {
  return content
    .map(mapSingleContentToCodexInput)
    .filter((x): x is CodexInputItem => x != null)
}

export interface CodexSessionBase {
  logger: AdapterCtx['logger']
  cwd: string
  binaryPath: string
  spawnEnv: NodeJS.ProcessEnv
  useYolo: boolean
  approvalPolicy: CodexApprovalPolicy
  sandboxPolicy: CodexSandboxPolicy
  features: Record<string, boolean>
  configOverrideArgs: string[]
  resolvedModel: string | undefined
  resolvedMaxOutputTokens: number | null | undefined
  effectiveEffort: AdapterQueryOptions['effort']
  turnEffort?: CodexReasoningEffort
  threadCacheKey: string
  cachedThreadId: string | undefined
  nativeCatalog?: NativeModelCatalog
  proxyCatalog?: CodexProxyCatalog
  proxyCatalogSessionKey?: string
  modelFallback?: string
}

export const getErrorSummary = (err: unknown) => (
  err instanceof Error ? err.message : String(err)
)

export const getErrorDetails = (err: unknown): unknown => (
  err instanceof CodexRpcError ? err.data : undefined
)

const formatErrorDetails = (value: unknown): string | undefined => {
  if (value == null) return undefined
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const getErrorMessage = (err: unknown) => {
  const summary = getErrorSummary(err)
  const details = formatErrorDetails(getErrorDetails(err))
  return details ? `${summary}\nDetails: ${details}` : summary
}

export const toAdapterErrorData = (
  err: unknown,
  overrides: Partial<{ message: string; code: string; details: unknown; fatal: boolean }> = {}
) => ({
  message: overrides.message ?? getErrorSummary(err),
  ...(overrides.code != null
    ? { code: overrides.code }
    : err instanceof CodexRpcError
    ? { code: String(err.code) }
    : {}),
  ...(overrides.details !== undefined
    ? { details: overrides.details }
    : getErrorDetails(err) !== undefined
    ? { details: getErrorDetails(err) }
    : {}),
  fatal: overrides.fatal ?? true
})

export const isInvalidEncryptedContentError = (err: unknown) => {
  const message = getErrorMessage(err)
  return message.includes('invalid_encrypted_content') || message.includes('organization_id did not match')
}

const CODEX_BUILTIN_API_BASE_URL = 'https://api.openai.com/v1'
const CODEX_BUILTIN_CHATGPT_BASE_URL = 'https://chatgpt.com/backend-api/codex'

const resolveCodexBuiltinBaseUrl = async (homeDir: string) => {
  const authPath = resolve(homeDir, '.codex', 'auth.json')

  try {
    const authContent = await readFile(authPath, 'utf8')
    const parsed = JSON.parse(authContent) as { auth_mode?: unknown }
    const authMode = typeof parsed.auth_mode === 'string' ? parsed.auth_mode.trim().toLowerCase() : undefined
    return authMode === 'chatgpt'
      ? CODEX_BUILTIN_CHATGPT_BASE_URL
      : CODEX_BUILTIN_API_BASE_URL
  } catch {
    return CODEX_BUILTIN_API_BASE_URL
  }
}

const buildCodexNativeCatalog = async (
  homeDir: string,
  configs: [import('@vibe-forge/types').Config?, import('@vibe-forge/types').Config?]
): Promise<NativeModelCatalog | undefined> => {
  const [config, userConfig] = configs
  const mergedModelServices = {
    ...(config?.modelServices ?? {}),
    ...(userConfig?.modelServices ?? {})
  }
  const mergedModels = {
    ...(config?.models ?? {}),
    ...(userConfig?.models ?? {})
  }

  const builtinBaseUrl = await resolveCodexBuiltinBaseUrl(homeDir)
  const builtinRoutes = resolveBuiltinPassthroughRoutes({
    builtinModels,
    resolveUpstream: (builtinValue: string) => ({
      upstreamBaseUrl: builtinBaseUrl,
      upstreamModel: builtinValue
    }),
    models: mergedModels,
    baseOrder: 0
  })

  const serviceRoutes = resolveServiceRoutes({
    modelServices: mergedModelServices,
    models: mergedModels,
    recommendedModels: [
      ...(config?.recommendedModels ?? []),
      ...(userConfig?.recommendedModels ?? [])
    ],
    nativeIdStrategy: 'vf_prefixed',
    baseOrder: builtinModels.length,
    resolveServiceMeta: (_serviceKey, service) => {
      const { wireApi, queryParams, headers } = (service.extra?.codex as CodexModelProviderExtra | undefined) ?? {}
      const normalizedBaseUrl = normalizeProviderBaseUrl(service.apiBaseUrl, wireApi)
      const normalizedHeaders = normalizeStringRecord(headers)
      const normalizedQueryParams = normalizeStringRecord(queryParams)
      const mergedHeaders = typeof service.apiKey === 'string' && service.apiKey.trim() !== ''
        ? { Authorization: `Bearer ${service.apiKey}`, ...normalizedHeaders }
        : Object.keys(normalizedHeaders).length > 0
        ? normalizedHeaders
        : undefined
      return {
        upstreamBaseUrl: normalizedBaseUrl ?? undefined,
        headers: mergedHeaders,
        queryParams: Object.keys(normalizedQueryParams).length > 0 ? normalizedQueryParams : undefined
      }
    }
  })

  if (builtinRoutes.length === 0 && serviceRoutes.length === 0) return undefined

  const defaultSelector = userConfig?.defaultModel ?? config?.defaultModel
  return buildNativeModelCatalog({ builtinRoutes, serviceRoutes, defaultSelector })
}

async function buildThreadCacheKey(params: {
  cwd: string
  homeDir: string
  useYolo: boolean
  approvalPolicy: CodexApprovalPolicy
  sandboxPolicy: CodexSandboxPolicy
  configFingerprintArgs: string[]
  features: Record<string, boolean>
}) {
  const authPath = resolve(params.homeDir, '.codex', 'auth.json')
  let authDigest: string | undefined

  try {
    const authContent = await readFile(authPath, 'utf8')
    authDigest = createHash('sha256').update(authContent).digest('hex')
  } catch {
    authDigest = undefined
  }

  const fingerprint = createHash('sha256')
    .update(JSON.stringify({
      cwd: params.cwd,
      useYolo: params.useYolo,
      approvalPolicy: params.approvalPolicy,
      sandboxPolicy: params.sandboxPolicy,
      configOverrideArgs: params.configFingerprintArgs,
      features: params.features,
      authDigest: authDigest ?? null
    }))
    .digest('hex')

  return `context:${fingerprint}`
}

export async function resolveSessionBase(
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<CodexSessionBase> {
  const { logger, cwd, env, cache, configs: [config, userConfig] } = ctx
  const codexHomeDir = resolveCodexHomeDir(env)

  const {
    sandboxPolicy: configSandboxPolicy,
    effort: configuredEffort,
    features: configFeatures,
    configOverrides: configOverridesValue,
    nativeModelSwitch: configNativeModelSwitch,
    nativeModelSwitchBootstrap: configNativeModelSwitchBootstrap
  } = {
    ...(config?.adapters?.codex ?? {}),
    ...(userConfig?.adapters?.codex ?? {})
  } as {
    sandboxPolicy?: CodexSandboxPolicy
    effort?: AdapterQueryOptions['effort']
    features?: Record<string, boolean>
    configOverrides?: Record<string, unknown>
    nativeModelSwitch?: boolean
    nativeModelSwitchBootstrap?: boolean
  }

  const useYolo = shouldUseYolo(options.permissionMode)
  const approvalPolicy = resolveApprovalPolicy(options.permissionMode)
  const sandboxPolicy: CodexSandboxPolicy = useYolo
    ? { type: 'dangerFullAccess' }
    : (configSandboxPolicy ?? { type: 'workspaceWrite' })
  const features: Record<string, boolean> = { ...(configFeatures ?? {}) }

  const mergedModelServices: Record<string, ModelServiceConfig> = {
    ...(config?.modelServices ?? {}),
    ...(userConfig?.modelServices ?? {})
  }

  const configOverrides = mergeCodexConfigOverrides(
    isPlainObject(configOverridesValue) ? configOverridesValue : {}
  )
  const nativeReasoningEffort = normalizeCodexReasoningEffort(configOverrides.model_reasoning_effort)
  const requestedEffort = options.effort ?? configuredEffort
  const requestedReasoningEffort = mapPublicEffortToCodex(requestedEffort)
  const effectiveEffort = nativeReasoningEffort != null
    ? mapCodexEffortToPublic(nativeReasoningEffort)
    : requestedEffort

  const nativeBootstrapEnabled = configNativeModelSwitch === true &&
    configNativeModelSwitchBootstrap === true
  const nativeCatalog = nativeBootstrapEnabled
    ? await buildCodexNativeCatalog(codexHomeDir, ctx.configs)
    : undefined
  const hasCatalogRoutes = nativeCatalog != null && nativeCatalog.routes.length > 0

  const routedServiceKey = resolveRoutedServiceKey(options.model)
  const routedService = routedServiceKey != null ? mergedModelServices[routedServiceKey] : undefined
  const hasRoutedService = typeof routedService?.apiBaseUrl === 'string' && routedService.apiBaseUrl.trim() !== ''
  const hasServiceRoutes = nativeCatalog != null &&
    nativeCatalog.routes.some(r => r.kind === 'service')
  const shouldUseProxy = hasRoutedService || (nativeBootstrapEnabled && hasServiceRoutes)
  const proxyLogger = shouldUseProxy
    ? createLogger(
      cwd,
      `${ctx.ctxId}/${options.sessionId ?? 'default'}/adapter-codex`,
      'proxy'
    )
    : undefined
  const proxyBaseUrl = shouldUseProxy
    ? (await ensureCodexProxyServer(proxyLogger)).baseUrl
    : undefined
  if (proxyBaseUrl != null && routedServiceKey != null && proxyLogger != null) {
    proxyLogger.info('[codex session] using local proxy for routed model service', {
      serviceKey: routedServiceKey,
      proxyBaseUrl,
      upstreamBaseUrl: normalizeProviderBaseUrl(
        routedService?.apiBaseUrl,
        ((routedService?.extra?.codex as CodexModelProviderExtra | undefined) ?? {}).wireApi
      ) ?? routedService?.apiBaseUrl
    })
  }

  const {
    args: configOverrideArgs,
    fingerprintArgs: configFingerprintArgs,
    resolvedModel: initialResolvedModel,
    resolvedMaxOutputTokens
  } = buildCodexConfigOverrides({
    systemPrompt: options.systemPrompt,
    rawModel: options.model,
    modelServices: mergedModelServices,
    proxyBaseUrl,
    proxyLogContext: proxyBaseUrl != null
      ? {
        cwd,
        ctxId: ctx.ctxId,
        sessionId: options.sessionId ?? 'default'
      }
      : undefined,
    proxyDiagnostics: proxyBaseUrl != null
      ? {
        runtime: options.runtime,
        sessionType: options.type,
        permissionMode: options.permissionMode,
        approvalPolicy,
        sandboxPolicy: sandboxPolicy.type,
        useYolo,
        requestedModel: options.model,
        requestedEffort,
        effectiveEffort
      }
      : undefined
  })
  let resolvedModel = initialResolvedModel

  const nativeConfigOverrideArgs = buildNativeConfigOverrideArgs(configOverrides)
  configOverrideArgs.push(...nativeConfigOverrideArgs)
  configFingerprintArgs.push(...nativeConfigOverrideArgs)
  if (nativeReasoningEffort == null && requestedReasoningEffort != null) {
    configOverrideArgs.push('-c', `model_reasoning_effort=${toToml(requestedReasoningEffort)}`)
    configFingerprintArgs.push('-c', `model_reasoning_effort=${toToml(requestedReasoningEffort)}`)
  }

  const filteredMcpServers: Record<string, unknown> = options.assetPlan?.mcpServers ?? (() => {
    const mergedMcpServers = {
      ...(config?.mcpServers ?? {}),
      ...(userConfig?.mcpServers ?? {})
    }
    const defaultInclude = [
      ...(config?.defaultIncludeMcpServers ?? []),
      ...(userConfig?.defaultIncludeMcpServers ?? [])
    ]
    const defaultExclude = [
      ...(config?.defaultExcludeMcpServers ?? []),
      ...(userConfig?.defaultExcludeMcpServers ?? [])
    ]
    const includeMcpServers = options.mcpServers?.include ?? (defaultInclude.length > 0 ? defaultInclude : undefined)
    const excludeMcpServers = options.mcpServers?.exclude ?? (defaultExclude.length > 0 ? defaultExclude : undefined)

    const nextServers: Record<string, unknown> = {}
    for (const [key, server] of Object.entries(mergedMcpServers)) {
      if ((server as { enabled?: boolean }).enabled === false) continue
      if (includeMcpServers && !includeMcpServers.includes(key)) continue
      if (excludeMcpServers?.includes(key)) continue
      const { enabled: _enabled, ...serverConfig } = server as { enabled?: boolean; [k: string]: unknown }
      nextServers[key] = serverConfig
    }
    return nextServers
  })()

  const mcpConfigArgs = buildMcpConfigArgs(filteredMcpServers, env)
  configOverrideArgs.push(...mcpConfigArgs)
  configFingerprintArgs.push(...mcpConfigArgs)

  const binaryPath = resolveCodexBinaryPath(env)
  await mkdir(resolve(codexHomeDir, '.codex'), { recursive: true })
  const spawnEnv = buildSpawnEnv(env)

  if (env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ === '1') {
    features.codex_hooks = true
    spawnEnv.__VF_VIBE_FORGE_CODEX_HOOKS_ACTIVE__ = '1'
    spawnEnv[NATIVE_HOOK_BRIDGE_ADAPTER_ENV] = 'codex'
    spawnEnv.__VF_CODEX_HOOK_RUNTIME__ = options.runtime
    spawnEnv.__VF_CODEX_TASK_SESSION_ID__ = options.sessionId
  }

  let proxyCatalog: CodexProxyCatalog | undefined
  let proxyCatalogSessionKey: string | undefined
  let modelFallback: string | undefined

  if (nativeCatalog != null && hasCatalogRoutes && resolvedModel != null) {
    const rawModel = options.model?.trim()
    const inCatalog = nativeCatalog.routes.some(r =>
      r.selectorValue === resolvedModel ||
      r.nativeModelId === resolvedModel ||
      (rawModel != null && (r.selectorValue === rawModel || r.nativeModelId === rawModel))
    )
    if (!inCatalog && nativeCatalog.defaultRoute != null) {
      modelFallback = nativeCatalog.defaultRoute.selectorValue
      resolvedModel = modelFallback
    }
  }

  // Determine if the effective model maps to a VF service route (vs. a Codex builtin).
  // Only service-route models should be routed through the VF proxy; builtin models
  // must use Codex's native provider/transport to preserve original auth and subscriptions.
  const currentModelIsServiceRoute = nativeCatalog != null && (() => {
    const rawModel = options.model?.trim()
    const candidates = [rawModel, resolvedModel].filter(
      (c): c is string => c != null && c !== ''
    )
    return candidates.some(candidate =>
      nativeCatalog!.routes.some(r =>
        r.kind === 'service' &&
        (r.selectorValue === candidate || r.nativeModelId === candidate || r.upstreamModel === candidate)
      )
    )
  })()

  if (nativeBootstrapEnabled && hasCatalogRoutes && nativeCatalog != null && proxyBaseUrl != null) {
    // Only install VF proxy routing when the current model is a service route.
    // Builtin models keep Codex's native provider/transport untouched.
    const serviceRoutes = nativeCatalog.routes.filter(r => r.kind === 'service')
    if (currentModelIsServiceRoute && serviceRoutes.length > 0) {
      proxyCatalogSessionKey = `${ctx.ctxId}/${options.sessionId ?? 'default'}`

      const rawModel = options.model?.trim()
      const initialRoute = rawModel != null
        ? nativeCatalog.routes.find(r => r.selectorValue === rawModel || r.nativeModelId === rawModel)
        : undefined
      const initialNativeModelId = initialRoute?.nativeModelId ?? resolvedModel

      // Register ALL catalog routes (service + builtin) in the proxy catalog.
      // When model_provider=vibe_forge is active, every request goes through the proxy.
      // Builtin routes need to be present so that mid-session /model switches to a
      // builtin can be forwarded to the correct upstream (e.g. api.openai.com).
      proxyCatalog = createCodexProxyCatalog({
        routes: nativeCatalog.routes,
        initialNativeModelId
      })
      registerProxyCatalog(proxyCatalogSessionKey, proxyCatalog)

      // Install vibe_forge provider so Codex routes requests through the local proxy.
      // When routedServiceKey is set, buildCodexConfigOverrides already pushed a service-
      // specific model_provider; the later `-c model_provider=vibe_forge` overrides it so
      // all requests go through the session-header catalog path for dynamic switching.
      configOverrideArgs.push('-c', `model_provider=${toToml('vibe_forge')}`)
      configFingerprintArgs.push('-c', `model_provider=${toToml('vibe_forge')}`)
      configOverrideArgs.push('-c', `model_providers.vibe_forge.name=${toToml('Vibe Forge')}`)
      configFingerprintArgs.push('-c', `model_providers.vibe_forge.name=${toToml('Vibe Forge')}`)
      configOverrideArgs.push('-c', `model_providers.vibe_forge.base_url=${toToml(proxyBaseUrl)}`)
      configFingerprintArgs.push('-c', `model_providers.vibe_forge.base_url=${toToml(proxyBaseUrl)}`)
      configOverrideArgs.push(
        '-c',
        `model_providers.vibe_forge.http_headers=${
          toTomlInlineTable({
            [CODEX_PROXY_SESSION_HEADER_NAME]: proxyCatalogSessionKey!
          })
        }`
      )
      configFingerprintArgs.push(
        '-c',
        `model_providers.vibe_forge.http_headers=${
          toTomlInlineTable({
            [CODEX_PROXY_SESSION_HEADER_NAME]: 'session'
          })
        }`
      )
    }

    // Always write the model catalog so both builtin and custom models appear in
    // the /model menu — VF is an incremental extension, not a replacement.
    const modelCatalog = await buildCodexModelCatalog({
      nativeCatalog,
      homeDir: codexHomeDir
    })
    const { cachePath: modelCatalogPath } = await cache.set('adapter.codex.model-catalog', modelCatalog)
    configOverrideArgs.push('-c', `model_catalog_json=${toToml(modelCatalogPath)}`)
    configFingerprintArgs.push('-c', `model_catalog_json=${toToml(modelCatalogPath)}`)
  }

  const threadCacheKey = await buildThreadCacheKey({
    cwd,
    homeDir: codexHomeDir,
    useYolo,
    approvalPolicy,
    sandboxPolicy,
    configFingerprintArgs,
    features
  })
  let cachedThreadId: string | undefined
  if (options.type === 'resume') {
    const cachedThreads = await cache.get('adapter.codex.threads')
    cachedThreadId = cachedThreads?.[threadCacheKey]
  }

  return {
    logger,
    cwd,
    binaryPath,
    spawnEnv,
    useYolo,
    approvalPolicy,
    sandboxPolicy,
    features,
    configOverrideArgs,
    resolvedModel,
    resolvedMaxOutputTokens,
    effectiveEffort,
    turnEffort: nativeReasoningEffort == null ? requestedReasoningEffort : undefined,
    threadCacheKey,
    cachedThreadId,
    nativeCatalog,
    proxyCatalog,
    proxyCatalogSessionKey,
    modelFallback
  }
}
