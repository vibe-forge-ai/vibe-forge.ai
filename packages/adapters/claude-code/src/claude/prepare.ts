import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'

import { ensureClaudeCodeRouterReady } from '../ccr/daemon'
import { resolveClaudeCliPath } from '../ccr/paths'
import { stageClaudePluginDirs } from './plugins'

interface ClaudeExecutionSettings {
  [key: string]: unknown
  mcpServers: Record<string, unknown>
  permissions: {
    allow: string[]
    deny: string[]
    ask: string[]
    defaultMode?: AdapterQueryOptions['permissionMode']
  }
  defaultIncludeMcpServers: string[]
  defaultExcludeMcpServers: string[]
  plansDirectory: string
  env: Record<string, string | null | undefined>
  companyAnnouncements: string[]
}

interface PreparedClaudeExecution {
  cliPath: string
  args: string[]
  env: Record<string, string | null | undefined>
  cwd: string
  sessionId: string
  effort?: AdapterQueryOptions['effort']
  executionType: 'create' | 'resume'
}

const resolveCCRRequestLogContextPath = (cwd: string, sessionId: string) =>
  join(
    cwd,
    '.ai',
    '.mock',
    '.claude-code-router',
    'request-log-context',
    `${sessionId}.json`
  )

const persistCCRRequestLogContext = async (params: {
  cwd: string
  ctxId: string
  sessionId: string
}) => {
  const filePath = resolveCCRRequestLogContextPath(params.cwd, params.sessionId)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(
    filePath,
    JSON.stringify({
      ctxId: params.ctxId,
      sessionId: params.sessionId
    }),
    'utf8'
  )
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const deepMerge = (
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key] as Record<string, unknown>, value)
      continue
    }
    merged[key] = value
  }
  return merged
}

const normalizeEffort = (value: unknown): AdapterQueryOptions['effort'] => (
  value === 'low' || value === 'medium' || value === 'high' || value === 'max'
    ? value
    : undefined
)

const uniqueStrings = (values: string[]) => [...new Set(values)]

export const prepareClaudeExecution = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<PreparedClaudeExecution> => {
  const { env, cwd, cache, configs: [config, userConfig] } = ctx
  const assetPlan = options.assetPlan
  const nativeHooksAvailable = env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ === '1'
  const {
    effort,
    description,
    sessionId,
    model,
    type,
    systemPrompt,
    appendSystemPrompt = true,
    permissionMode,
    mcpServers: inputMCPServersRule,
    tools: inputToolsRule
  } = options
  const resumeState = await cache.get('adapter.claude-code.resume-state')
  const executionType = type === 'resume'
    ? resumeState?.canResume === false
      ? 'create'
      : 'resume'
    : 'create'
  const mergedAdapterConfig = {
    ...(config?.adapters?.['claude-code'] ?? {}),
    ...(userConfig?.adapters?.['claude-code'] ?? {})
  } as {
    effort?: AdapterQueryOptions['effort']
    settingsContent?: Record<string, unknown>
    nativeEnv?: Record<string, string>
  }
  const requestedEffort = effort ?? mergedAdapterConfig.effort
  const settingsContent = isPlainObject(mergedAdapterConfig.settingsContent)
    ? mergedAdapterConfig.settingsContent
    : {}
  const nativeEnv = isPlainObject(mergedAdapterConfig.nativeEnv)
    ? Object.fromEntries(
      Object.entries(mergedAdapterConfig.nativeEnv).filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string'
      )
    )
    : {}
  const nativeEnvEffort = normalizeEffort(nativeEnv.CLAUDE_CODE_EFFORT_LEVEL)
  const settingsContentEffort = normalizeEffort(settingsContent.effortLevel)

  let settings: ClaudeExecutionSettings = {
    mcpServers: assetPlan?.mcpServers ?? {
      ...config?.mcpServers,
      ...userConfig?.mcpServers
    },
    permissions: {
      allow: [
        ...(config?.permissions?.allow ?? []),
        ...(userConfig?.permissions?.allow ?? [])
      ],
      deny: [
        ...(config?.permissions?.deny ?? []),
        ...(userConfig?.permissions?.deny ?? [])
      ],
      ask: [
        ...(config?.permissions?.ask ?? []),
        ...(userConfig?.permissions?.ask ?? [])
      ],
      defaultMode: permissionMode ??
        userConfig?.permissions?.defaultMode ??
        config?.permissions?.defaultMode
    },
    defaultIncludeMcpServers: [
      ...(config?.defaultIncludeMcpServers ?? []),
      ...(userConfig?.defaultIncludeMcpServers ?? [])
    ],
    defaultExcludeMcpServers: [
      ...(config?.defaultExcludeMcpServers ?? []),
      ...(userConfig?.defaultExcludeMcpServers ?? [])
    ],
    plansDirectory: './.ai/works',
    env: {
      ...(config?.env ?? {}),
      ...(userConfig?.env ?? {}),
      ...(nativeHooksAvailable
        ? {
          __VF_VIBE_FORGE_CLAUDE_HOOKS_ACTIVE__: '1',
          [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'claude-code',
          __VF_CLAUDE_HOOK_RUNTIME__: options.runtime,
          __VF_CLAUDE_TASK_SESSION_ID__: sessionId
        }
        : {})
    } as Record<string, string | null | undefined>,
    companyAnnouncements: [
      ...(config?.announcements ?? []),
      ...(userConfig?.announcements ?? [])
    ]
  }
  if (
    nativeEnvEffort == null &&
    settingsContentEffort == null &&
    (requestedEffort === 'low' || requestedEffort === 'medium' || requestedEffort === 'high')
  ) {
    settings = {
      ...settings,
      effortLevel: requestedEffort
    }
  }
  settings = deepMerge(settings, settingsContent) as ClaudeExecutionSettings
  const useCCR = typeof model === 'string' && model.includes(',')
  if (useCCR) {
    const router = await ensureClaudeCodeRouterReady(ctx)
    settings.env = {
      ...settings.env,
      ANTHROPIC_BASE_URL: `http://${router.host}:${router.port}`,
      ANTHROPIC_AUTH_TOKEN: router.apiKey,
      ANTHROPIC_API_KEY: '',
      API_TIMEOUT_MS: String(router.apiTimeoutMs)
    }
    await persistCCRRequestLogContext({
      cwd,
      ctxId: ctx.ctxId,
      sessionId
    })
  }
  const { mcpServers, ...unresolvedSettings } = settings
  unresolvedSettings.permissions.allow = [
    ...(unresolvedSettings.permissions.allow ?? []),
    ...(inputToolsRule?.include ?? [])
  ]
  unresolvedSettings.permissions.deny = [
    ...(unresolvedSettings.permissions.deny ?? []),
    ...(inputToolsRule?.exclude ?? [])
  ]

  if (options.runtime === 'server') {
    unresolvedSettings.permissions.allow = (unresolvedSettings.permissions.allow ?? [])
      .filter(name => name !== 'AskUserQuestion')
    unresolvedSettings.permissions.deny = uniqueStrings([
      ...(unresolvedSettings.permissions.deny ?? []),
      'AskUserQuestion'
    ])
  }

  const includeMcpServers = inputMCPServersRule?.include ?? settings.defaultIncludeMcpServers
  const excludeMcpServers = inputMCPServersRule?.exclude ?? settings.defaultExcludeMcpServers
  if ((includeMcpServers?.length ?? 0) > 0) {
    Object.keys(mcpServers).forEach((key) => {
      if (!includeMcpServers?.includes(key)) {
        delete mcpServers[key]
      }
    })
  }
  if ((excludeMcpServers?.length ?? 0) > 0) {
    Object.keys(mcpServers).forEach((key) => {
      if (excludeMcpServers?.includes(key)) {
        delete mcpServers[key]
      }
    })
  }

  const { cachePath: mcpCachePath } = await cache.set(
    'adapter.claude-code.mcp',
    { mcpServers }
  )
  const { cachePath: settingsCachePath } = await cache.set(
    'adapter.claude-code.settings',
    settings
  )
  const pluginDirs = await stageClaudePluginDirs({
    cwd,
    ctxId: ctx.ctxId,
    sessionId
  })

  const args: string[] = [
    ...(description
      ? [JSON.stringify(
          `${(
          description?.trimStart().startsWith('-') ? '\0' : ''
        )}${(
          description.replace(/`/g, "'")
        )}`
      )]
      : []),
    '--mcp-config',
    mcpCachePath,
    '--settings',
    settingsCachePath,
    ...pluginDirs.flatMap(pluginDir => ['--plugin-dir', pluginDir])
  ].filter((a) => typeof a === 'string')

  if (permissionMode === 'bypassPermissions') {
    args.push('--dangerously-skip-permissions')
  } else if (
    permissionMode != null &&
    permissionMode !== 'default'
  ) {
    args.push('--permission-mode', permissionMode)
  }

  if (executionType === 'create') {
    args.push('--session-id', sessionId)
  } else {
    args.push('--resume', sessionId)
  }

  if (model != null && model !== '') args.push('--model', model)

  if (systemPrompt != null && systemPrompt !== '') {
    args.push(
      appendSystemPrompt ? '--append-system-prompt' : '--system-prompt',
      systemPrompt.replace(/`/g, "'")
    )
  }

  const executionEnv: Record<string, string | null | undefined> = {
    ...env,
    ...(
      requestedEffort === 'max' &&
        nativeEnvEffort == null &&
        settingsContentEffort == null
        ? { CLAUDE_CODE_EFFORT_LEVEL: 'max' }
        : {}
    ),
    ...nativeEnv,
    ...(nativeHooksAvailable
      ? {
        __VF_VIBE_FORGE_CLAUDE_HOOKS_ACTIVE__: '1',
        [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'claude-code',
        __VF_CLAUDE_HOOK_RUNTIME__: options.runtime,
        __VF_CLAUDE_TASK_SESSION_ID__: sessionId
      }
      : {})
  }

  return {
    cliPath: resolveClaudeCliPath(),
    args,
    env: executionEnv,
    cwd,
    sessionId,
    effort: nativeEnvEffort ?? settingsContentEffort ?? requestedEffort,
    executionType
  }
}
