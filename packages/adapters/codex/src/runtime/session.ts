import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { ModelServiceConfig } from '@vibe-forge/core'
import type { AdapterCtx, AdapterEvent, AdapterQueryOptions } from '@vibe-forge/core/adapter'

import { resolveCodexBinaryPath } from '#~/paths.js'
import { AgentMessageAccumulator, CommandOutputAccumulator, handleIncomingNotification } from '#~/protocol/incoming.js'
import { CodexRpcClient } from '#~/protocol/rpc.js'
import type { CodexInputItem, CodexSandboxPolicy, CodexThread, CodexTurn } from '#~/types.js'

type CodexApprovalPolicy = 'never' | 'unlessTrusted' | 'onRequest'
type CodexOutboundApprovalPolicy = 'never' | 'untrusted' | 'on-request'

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
  return 'unlessTrusted' // 'default' | 'acceptEdits' | undefined
}

function toCodexOutboundApprovalPolicy(
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

  // system prompt → developer_instructions
  if (systemPrompt) {
    args.push('-c', `developer_instructions=${toToml(systemPrompt)}`)
  }

  // Resolve model and map the service to a codex model_provider
  let resolvedModel: string | undefined

  if (rawModel?.includes(',')) {
    // "service,model" format
    const commaIdx = rawModel.indexOf(',')
    const serviceKey = rawModel.slice(0, commaIdx).trim()
    const modelId = rawModel.slice(commaIdx + 1).trim()
    const service = modelServices[serviceKey]

    if (service) {
      const { title, apiBaseUrl, apiKey, extra } = service
      const { wireApi, queryParams } =
        (extra?.codex as { wireApi?: string; queryParams?: Record<string, string> } | undefined) ?? {}
      const prefix = `model_providers.${serviceKey}`

      args.push('-c', `model_provider=${toToml(serviceKey)}`)
      args.push('-c', `${prefix}.name=${toToml(title ?? serviceKey)}`)
      if (apiBaseUrl) {
        // If the base URL ends with '/responses' and wireApi is 'responses', codex appends
        // '/responses' itself — strip the suffix to avoid a double-path like .../responses/responses.
        const normalizedBaseUrl = (wireApi ?? 'responses') === 'responses' && apiBaseUrl.endsWith('/responses')
          ? apiBaseUrl.slice(0, -'/responses'.length)
          : apiBaseUrl
        args.push('-c', `${prefix}.base_url=${toToml(normalizedBaseUrl)}`)
      }
      if (apiKey) {
        // All vibe-forge model services are OpenAI-compatible; inject the API key
        // via the provider's experimental_bearer_token config key.
        args.push('-c', `${prefix}.experimental_bearer_token=${toToml(apiKey)}`)
      }
      if (wireApi) {
        args.push('-c', `${prefix}.wire_api=${toToml(wireApi)}`)
      }
      // Merge query params: apiKey defaults to ak=<key>, explicit queryParams take precedence.
      const mergedQueryParams = {
        ...(apiKey ? { ak: apiKey } : {}),
        ...queryParams
      }
      if (Object.keys(mergedQueryParams).length > 0) {
        args.push('-c', `${prefix}.query_params=${toTomlInlineTable(mergedQueryParams)}`)
      }
    }

    resolvedModel = modelId || undefined
  } else {
    resolvedModel = rawModel || undefined
  }

  return { args, resolvedModel }
}

/**
 * Encode a flat string→string record as a TOML inline table: `{key = "value", …}`.
 */
const toTomlInlineTable = (obj: Record<string, string>) =>
  `{${Object.entries(obj).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ')}}`

/**
 * Build `-c mcp_servers.<name>.*` overrides for each filtered MCP server.
 *
 * STDIO transport  (no `type` field, presence of `command` key):
 *   command, args (TOML array), env (TOML inline table)
 *
 * Streamable HTTP transport  (presence of `url` key):
 *   url, http_headers (TOML inline table, mapped from vibe-forge `headers`)
 *
 * Codex distinguishes the two transports solely by which key is present —
 * no explicit `type` field is written.
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
      // STDIO transport
      args.push('-c', `${prefix}.command=${toToml(command)}`)
      if (Array.isArray(cmdArgs) && cmdArgs.length > 0) {
        // TOML inline array — JSON array of strings is valid TOML
        args.push('-c', `${prefix}.args=${JSON.stringify(cmdArgs)}`)
      }
      if (env != null) {
        args.push('-c', `${prefix}.env=${toTomlInlineTable(env)}`)
      }
    } else if (typeof url === 'string') {
      // Streamable HTTP transport — vibe-forge `headers` → codex `http_headers`
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
function buildFeatureArgs(features: Record<string, boolean>): string[] {
  const args: string[] = []
  for (const [name, enabled] of Object.entries(features)) {
    args.push(enabled ? '--enable' : '--disable', name)
  }
  return args
}

/**
 * Map an array of vibe-forge `AdapterMessageContent` to Codex `turn/start` input items.
 */
function mapContentToCodexInput(
  content: Array<{ type: string; text?: string; url?: string; [k: string]: unknown }>
): CodexInputItem[] {
  return content
    .map(mapSingleContentToCodexInput)
    .filter((x): x is CodexInputItem => x != null)
}

interface CodexSessionBase {
  logger: AdapterCtx['logger']
  cwd: string
  binaryPath: string
  spawnEnv: NodeJS.ProcessEnv
  approvalPolicy: CodexApprovalPolicy
  sandboxPolicy: CodexSandboxPolicy
  features: Record<string, boolean>
  /** `-c key=value` args for developer_instructions, model_providers, and mcp_servers overrides. */
  configOverrideArgs: string[]
  /** Plain model id after stripping any `service,` prefix. */
  resolvedModel: string | undefined
  /** Codex-native thread/session UUID cached from a previous session; used by `resume` mode. */
  cachedThreadId: string | undefined
}

async function resolveSessionBase(
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<CodexSessionBase> {
  const { logger, cwd, env, cache, configs: [config, userConfig] } = ctx

  const {
    sandboxPolicy: configSandboxPolicy,
    features: configFeatures
  } = {
    // eslint-disable-next-line dot-notation
    ...(config?.adapters?.['codex'] ?? {}),
    // eslint-disable-next-line dot-notation
    ...(userConfig?.adapters?.['codex'] ?? {})
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

  // Merge and filter MCP servers; write to cache and inject --mcp-config if any remain.
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

  // Inject MCP server config via -c mcp_servers.<name>.* overrides.
  configOverrideArgs.push(...buildMcpConfigArgs(filteredMcpServers))

  // For resume sessions, look up the codex-native thread ID that was cached during
  // a previous stream-mode (or direct-mode) session so we can pass it to `codex resume`.
  let cachedThreadId: string | undefined
  if (options.type === 'resume') {
    const cachedThreads = await cache.get('adapter.codex.threads')
    cachedThreadId = cachedThreads?.[options.sessionId]
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
    cachedThreadId
  }
}

/**
 * Spawn `codex [prompt?]` or `codex resume [SESSION_ID|--last] [prompt?]` with
 * `stdio: 'inherit'`, handing the terminal directly to the user.
 * `emit()` is a no-op in this mode.
 */
function createDirectCodexSession(base: CodexSessionBase, options: AdapterQueryOptions) {
  const {
    logger,
    cwd,
    binaryPath,
    spawnEnv,
    approvalPolicy,
    sandboxPolicy,
    features,
    configOverrideArgs,
    resolvedModel,
    cachedThreadId
  } = base
  const { onEvent, description, extraOptions, type: sessionType } = options

  const isResume = sessionType === 'resume'
  const approvalFlag = toCodexOutboundApprovalPolicy(approvalPolicy)

  // When resuming, the subcommand must come before all other flags.
  const args: string[] = isResume
    ? ['resume', ...configOverrideArgs]
    : [...configOverrideArgs]

  if (resolvedModel) {
    args.push('--model', resolvedModel)
  }

  // Sandbox policy: camelCase type → kebab-case CLI value
  const sandboxFlag = sandboxPolicy.type === 'workspaceWrite'
    ? 'workspace-write'
    : sandboxPolicy.type === 'readOnly'
    ? 'read-only'
    : sandboxPolicy.type === 'dangerFullAccess'
    ? 'danger-full-access'
    : undefined
  if (sandboxFlag) {
    args.push('--sandbox', sandboxFlag)
  }

  args.push('--ask-for-approval', approvalFlag)

  // Feature flags: --enable / --disable
  args.push(...buildFeatureArgs(features))

  // Arbitrary extra flags (e.g. '--full-auto', '--search', '--add-dir', …)
  if (extraOptions?.length) {
    args.push(...extraOptions)
  }

  if (isResume) {
    // SESSION_ID (positional) — if we have a cached codex-native thread ID use it;
    // otherwise fall back to --last which picks the most recent recorded session.
    if (cachedThreadId) {
      args.push(cachedThreadId)
    } else {
      args.push('--last')
    }
  }

  // Prompt is a positional argument — must come last
  if (description) {
    args.push(description)
  }

  logger.info('[codex session] spawning CLI (direct mode)', { binaryPath, args, cwd })

  const proc = spawn(String(binaryPath), args, { env: spawnEnv, cwd, stdio: 'inherit' })

  proc.on('exit', (code) => {
    onEvent({ type: 'exit', data: { exitCode: code ?? undefined } })
  })

  return {
    kill: () => proc.kill(),
    emit: () => {
      logger.warn('[codex session] emit() is not supported in direct mode')
    },
    pid: proc.pid
  }
}

/**
 * Spawn `codex app-server` and drive it over JSON-RPC 2.0 (JSONL),
 * forwarding events to `onEvent`.
 */
async function createStreamCodexSession(
  base: CodexSessionBase,
  ctx: AdapterCtx,
  options: AdapterQueryOptions
) {
  const {
    logger,
    cwd,
    binaryPath,
    spawnEnv,
    approvalPolicy,
    sandboxPolicy,
    features,
    configOverrideArgs,
    resolvedModel
  } = base
  const { cache, configs: [config, userConfig] } = ctx
  const { onEvent, description, sessionId, type: sessionType } = options
  const model = resolvedModel
  const rpcApprovalPolicy = toCodexOutboundApprovalPolicy(approvalPolicy)

  const {
    experimentalApi = false,
    effort,
    clientInfo: rawClientInfo = {}
  } = {
    // eslint-disable-next-line dot-notation
    ...(config?.adapters?.['codex'] ?? {}),
    // eslint-disable-next-line dot-notation
    ...(userConfig?.adapters?.['codex'] ?? {})
  } as {
    experimentalApi?: boolean
    effort?: string
    clientInfo?: { name?: string; title?: string; version?: string }
  }
  const clientInfo = {
    name: rawClientInfo.name ?? 'vibe-forge',
    title: rawClientInfo.title ?? 'Vibe Forge',
    version: rawClientInfo.version ?? '0.1.0'
  }

  logger.info('[codex session] spawning app-server (stream mode)', { binaryPath, cwd })

  const proc = spawn(
    String(binaryPath),
    ['app-server', ...configOverrideArgs, ...buildFeatureArgs(features)],
    { env: spawnEnv, cwd, stdio: ['pipe', 'pipe', 'inherit'] }
  )

  const rpc = new CodexRpcClient(proc, logger)
  const msgAcc = new AgentMessageAccumulator()
  const cmdAcc = new CommandOutputAccumulator()
  let activeTurnId: string | undefined

  rpc.onNotification((method, params) => {
    if (method === 'turn/started') {
      activeTurnId = (params as { turn?: { id?: string } }).turn?.id
    } else if (method === 'turn/completed') {
      activeTurnId = undefined
    }
    handleIncomingNotification(method, params, rpc, onEvent, msgAcc, cmdAcc, approvalPolicy)
  })

  proc.on('exit', (code) => {
    rpc.destroy('process exited')
    onEvent({ type: 'exit', data: { exitCode: code ?? undefined } })
  })

  const initResult = await rpc.request<{ userAgent?: string }>('initialize', {
    clientInfo,
    capabilities: {
      experimentalApi,
      optOutNotificationMethods: [
        'turn/diff/updated',
        'turn/plan/updated',
        'thread/tokenUsage/updated'
      ]
    }
  })
  logger.info('[codex session] initialized', { userAgent: initResult?.userAgent })
  rpc.notify('initialized', {})

  let threadId: string | undefined

  if (sessionType === 'resume') {
    const cachedThreads = await cache.get('adapter.codex.threads')
    threadId = cachedThreads?.[sessionId]
  }

  if (threadId != null) {
    logger.info('[codex session] resuming thread', { threadId })
    const resumeResult = await rpc.request<{ thread: CodexThread }>('thread/resume', {
      threadId,
      ...(model ? { model } : {})
    })
    threadId = resumeResult.thread.id
  } else {
    logger.info('[codex session] starting new thread', { cwd })
    const startResult = await rpc.request<{ thread: CodexThread }>('thread/start', {
      cwd,
      approvalPolicy: rpcApprovalPolicy,
      sandboxPolicy,
      serviceName: 'vibe-forge',
      ...(model ? { model } : {})
    })
    threadId = startResult.thread.id
    const cachedThreads = (await cache.get('adapter.codex.threads')) ?? {}
    await cache.set('adapter.codex.threads', { ...cachedThreads, [sessionId]: threadId })
    logger.info('[codex session] thread started', { threadId })
  }

  if (description) {
    const input: CodexInputItem[] = [{ type: 'text', text: description }]
    const turnParams: Record<string, unknown> = {
      threadId,
      input,
      cwd,
      approvalPolicy: rpcApprovalPolicy,
      sandboxPolicy,
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {})
    }
    logger.info('[codex session] starting turn', { threadId, input })
    const turnResult = await rpc.request<{ turn: CodexTurn }>('turn/start', turnParams)
    logger.info('[codex session] turn started', { turnId: turnResult.turn.id })
  }

  const emit = (event: AdapterEvent) => {
    switch (event.type) {
      case 'message': {
        const textItems: CodexInputItem[] = mapContentToCodexInput(
          event.content as Array<{ type: string; text?: string; url?: string }>
        )
        if (activeTurnId != null) {
          rpc.request('turn/steer', {
            threadId: threadId!,
            input: textItems,
            expectedTurnId: activeTurnId
          }).catch((err) => {
            logger.error('[codex session] turn/steer failed', { err })
          })
        } else {
          const turnParams: Record<string, unknown> = {
            threadId: threadId!,
            input: textItems,
            cwd,
            approvalPolicy: rpcApprovalPolicy,
            sandboxPolicy,
            ...(model ? { model } : {}),
            ...(effort ? { effort } : {})
          }
          rpc.request('turn/start', turnParams).catch((err) => {
            logger.error('[codex session] turn/start from emit failed', { err })
          })
        }
        break
      }

      case 'interrupt': {
        if (activeTurnId != null) {
          rpc.request('turn/interrupt', {
            threadId: threadId!,
            turnId: activeTurnId
          }).catch((err) => {
            logger.error('[codex session] turn/interrupt failed', { err })
          })
        }
        break
      }

      case 'stop': {
        proc.kill()
        break
      }

      default:
        logger.warn('[codex session] unknown emit event', { event })
        break
    }
  }

  return {
    kill: () => {
      rpc.destroy('killed by caller')
      proc.kill()
    },
    emit,
    pid: proc.pid
  }
}

/**
 * Create a codex adapter session, dispatching to `direct` or `stream` mode
 * based on `options.mode` (default: `'stream'`).
 */
export const createCodexSession = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const base = await resolveSessionBase(ctx, options)
  return options.mode === 'direct'
    ? createDirectCodexSession(base, options)
    : createStreamCodexSession(base, ctx, options)
}
