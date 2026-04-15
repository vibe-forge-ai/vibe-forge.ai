import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'
import type { AdapterCtx, AdapterQueryOptions, ModelServiceConfig } from '@vibe-forge/types'
import { createLogger } from '@vibe-forge/utils/create-logger'

import { resolveCodexBinaryPath } from '#~/paths.js'
import { CodexRpcError } from '#~/protocol/rpc.js'
import type { CodexInputItem, CodexSandboxPolicy } from '#~/types.js'
import { CODEX_PROXY_META_HEADER_NAME, encodeCodexProxyMeta, ensureCodexProxyServer } from './proxy'

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
  '__VF_PROJECT_AI_PERMISSION_MODE__',
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

async function buildThreadCacheKey(params: {
  cwd: string
  useYolo: boolean
  approvalPolicy: CodexApprovalPolicy
  sandboxPolicy: CodexSandboxPolicy
  resolvedModel: string | undefined
  configFingerprintArgs: string[]
  features: Record<string, boolean>
}) {
  const authPath = resolve(process.env.HOME!, '.codex', 'auth.json')
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
      model: params.resolvedModel ?? null,
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

  const {
    sandboxPolicy: configSandboxPolicy,
    effort: configuredEffort,
    features: configFeatures,
    configOverrides: configOverridesValue
  } = {
    ...(config?.adapters?.codex ?? {}),
    ...(userConfig?.adapters?.codex ?? {})
  } as {
    sandboxPolicy?: CodexSandboxPolicy
    effort?: AdapterQueryOptions['effort']
    features?: Record<string, boolean>
    configOverrides?: Record<string, unknown>
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

  const routedServiceKey = resolveRoutedServiceKey(options.model)
  const routedService = routedServiceKey != null ? mergedModelServices[routedServiceKey] : undefined
  const shouldUseProxy = typeof routedService?.apiBaseUrl === 'string' && routedService.apiBaseUrl.trim() !== ''
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
    resolvedModel,
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
  await mkdir(resolve(process.env.HOME!, '.codex'), { recursive: true })
  const spawnEnv = buildSpawnEnv(env)

  if (env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ === '1') {
    features.codex_hooks = true
    spawnEnv.__VF_VIBE_FORGE_CODEX_HOOKS_ACTIVE__ = '1'
    spawnEnv[NATIVE_HOOK_BRIDGE_ADAPTER_ENV] = 'codex'
    spawnEnv.__VF_CODEX_HOOK_RUNTIME__ = options.runtime
    spawnEnv.__VF_CODEX_TASK_SESSION_ID__ = options.sessionId
  }

  const threadCacheKey = await buildThreadCacheKey({
    cwd,
    useYolo,
    approvalPolicy,
    sandboxPolicy,
    resolvedModel,
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
    cachedThreadId
  }
}
