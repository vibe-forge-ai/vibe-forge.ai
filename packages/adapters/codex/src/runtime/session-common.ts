import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { ModelServiceConfig } from '@vibe-forge/core'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/core/adapter'

import { resolveCodexBinaryPath } from '#~/paths.js'
import type { CodexInputItem, CodexSandboxPolicy } from '#~/types.js'

export type CodexApprovalPolicy = 'never' | 'unlessTrusted' | 'onRequest'
export type CodexOutboundApprovalPolicy = 'never' | 'untrusted' | 'on-request'

/**
 * Map a single vibe-forge `AdapterMessageContent` item to zero or one Codex input items.
 */
function mapSingleContentToCodexInput(
  item: { type: string; text?: string; url?: string; [k: string]: unknown }
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

/**
 * Encode a flat string→string record as a TOML inline table: `{key = "value", …}`.
 */
const toTomlInlineTable = (obj: Record<string, string>) =>
  `{${Object.entries(obj).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ')}}`

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
}): { args: string[]; resolvedModel: string | undefined } {
  const { systemPrompt, rawModel, modelServices } = params
  const args: string[] = []
  const normalizedRawModel = rawModel?.trim()

  if (systemPrompt) {
    args.push('-c', `developer_instructions=${toToml(systemPrompt)}`)
  }

  let resolvedModel: string | undefined

  if (normalizedRawModel?.toLowerCase() === 'default') {
    resolvedModel = undefined
  } else if (normalizedRawModel?.includes(',')) {
    const commaIdx = normalizedRawModel.indexOf(',')
    const serviceKey = normalizedRawModel.slice(0, commaIdx).trim()
    const modelId = normalizedRawModel.slice(commaIdx + 1).trim()
    const service = modelServices[serviceKey]

    if (service) {
      const { title, apiBaseUrl, apiKey, extra } = service
      const { wireApi, queryParams, headers } = (extra?.codex as CodexModelProviderExtra | undefined) ?? {}
      const prefix = `model_providers.${serviceKey}`

      args.push('-c', `model_provider=${toToml(serviceKey)}`)
      args.push('-c', `${prefix}.name=${toToml(title ?? serviceKey)}`)
      if (apiBaseUrl) {
        const normalizedBaseUrl = (wireApi ?? 'responses') === 'responses' && apiBaseUrl.endsWith('/responses')
          ? apiBaseUrl.slice(0, -'/responses'.length)
          : apiBaseUrl
        args.push('-c', `${prefix}.base_url=${toToml(normalizedBaseUrl)}`)
      }
      if (apiKey) {
        args.push('-c', `${prefix}.experimental_bearer_token=${toToml(apiKey)}`)
      }
      if (wireApi) {
        args.push('-c', `${prefix}.wire_api=${toToml(wireApi)}`)
      }
      const normalizedHeaders = normalizeStringRecord(headers)
      if (Object.keys(normalizedHeaders).length > 0) {
        args.push('-c', `${prefix}.http_headers=${toTomlInlineTable(normalizedHeaders)}`)
      }
      const mergedQueryParams = {
        ...(apiKey ? { ak: apiKey } : {}),
        ...normalizeStringRecord(queryParams)
      }
      if (Object.keys(mergedQueryParams).length > 0) {
        args.push('-c', `${prefix}.query_params=${toTomlInlineTable(mergedQueryParams)}`)
      }
    }

    resolvedModel = modelId || undefined
  } else {
    resolvedModel = normalizedRawModel || undefined
  }

  return { args, resolvedModel }
}

/**
 * Build `-c mcp_servers.<name>.*` overrides for each filtered MCP server.
 */
function buildMcpConfigArgs(servers: Record<string, unknown>): string[] {
  const args: string[] = []
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
    const prefix = `mcp_servers.${name}`

    if (typeof command === 'string') {
      args.push('-c', `${prefix}.command=${toToml(command)}`)
      if (Array.isArray(cmdArgs) && cmdArgs.length > 0) {
        args.push('-c', `${prefix}.args=${JSON.stringify(cmdArgs)}`)
      }
      if (env != null) {
        args.push('-c', `${prefix}.env=${toTomlInlineTable(env)}`)
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
  content: Array<{ type: string; text?: string; url?: string; [k: string]: unknown }>
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
  approvalPolicy: CodexApprovalPolicy
  sandboxPolicy: CodexSandboxPolicy
  features: Record<string, boolean>
  configOverrideArgs: string[]
  resolvedModel: string | undefined
  threadCacheKey: string
  cachedThreadId: string | undefined
}

export const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : String(err)

export const isInvalidEncryptedContentError = (err: unknown) => {
  const message = getErrorMessage(err)
  return message.includes('invalid_encrypted_content') || message.includes('organization_id did not match')
}

async function buildThreadCacheKey(params: {
  cwd: string
  resolvedModel: string | undefined
  configOverrideArgs: string[]
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
      model: params.resolvedModel ?? null,
      configOverrideArgs: params.configOverrideArgs,
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
    features: configFeatures
  } = {
    ...(config?.adapters?.codex ?? {}),
    ...(userConfig?.adapters?.codex ?? {})
  } as { sandboxPolicy?: CodexSandboxPolicy; features?: Record<string, boolean> }

  const approvalPolicy = resolveApprovalPolicy(options.permissionMode)
  const sandboxPolicy: CodexSandboxPolicy = configSandboxPolicy ?? { type: 'workspaceWrite' }
  const features: Record<string, boolean> = configFeatures ?? {}

  const mergedModelServices: Record<string, ModelServiceConfig> = {
    ...(config?.modelServices ?? {}),
    ...(userConfig?.modelServices ?? {})
  }

  const { args: configOverrideArgs, resolvedModel } = buildCodexConfigOverrides({
    systemPrompt: options.systemPrompt,
    rawModel: options.model,
    modelServices: mergedModelServices
  })

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

  const filteredMcpServers: Record<string, unknown> = {}
  for (const [key, server] of Object.entries(mergedMcpServers)) {
    if ((server as { enabled?: boolean }).enabled === false) continue
    if (includeMcpServers && !includeMcpServers.includes(key)) continue
    if (excludeMcpServers?.includes(key)) continue
    const { enabled: _enabled, ...serverConfig } = server as { enabled?: boolean; [k: string]: unknown }
    filteredMcpServers[key] = serverConfig
  }

  configOverrideArgs.push(...buildMcpConfigArgs(filteredMcpServers))

  const threadCacheKey = await buildThreadCacheKey({
    cwd,
    resolvedModel,
    configOverrideArgs,
    features
  })
  let cachedThreadId: string | undefined
  if (options.type === 'resume') {
    const cachedThreads = await cache.get('adapter.codex.threads')
    cachedThreadId = cachedThreads?.[threadCacheKey]
  }

  const binaryPath = resolveCodexBinaryPath(env)
  await mkdir(resolve(process.env.HOME!, '.codex'), { recursive: true })
  const spawnEnv = buildSpawnEnv(env)

  return {
    logger,
    cwd,
    binaryPath,
    spawnEnv,
    approvalPolicy,
    sandboxPolicy,
    features,
    configOverrideArgs,
    resolvedModel,
    threadCacheKey,
    cachedThreadId
  }
}
