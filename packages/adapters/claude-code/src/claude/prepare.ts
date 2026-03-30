import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'
import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'

import { ensureClaudeCodeRouterReady } from '../ccr/daemon'
import { resolveClaudeCliPath } from '../ccr/paths'

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
  enabledPlugins: Record<string, boolean>
  extraKnownMarketplaces: Record<string, unknown>
}

interface PreparedClaudeExecution {
  cliPath: string
  args: string[]
  env: Record<string, string | null | undefined>
  cwd: string
  sessionId: string
  executionType: 'create' | 'resume'
}

export const prepareClaudeExecution = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<PreparedClaudeExecution> => {
  const { env, cwd, cache, configs: [config, userConfig] } = ctx
  const assetPlan = options.assetPlan
  const nativeHooksAvailable = env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ === '1'
  const {
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
  const executionType = type === 'resume' && resumeState?.canResume === true ? 'resume' : 'create'

  const settings: ClaudeExecutionSettings = {
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
    ],
    enabledPlugins: assetPlan?.native.enabledPlugins ?? {
      ...(config?.enabledPlugins ?? {}),
      ...(userConfig?.enabledPlugins ?? {})
    },
    extraKnownMarketplaces: assetPlan?.native.extraKnownMarketplaces ?? {
      ...(config?.extraKnownMarketplaces ?? {}),
      ...(userConfig?.extraKnownMarketplaces ?? {})
    }
  }
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
    settingsCachePath
  ].filter((a) => typeof a === 'string')

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
    executionType
  }
}
