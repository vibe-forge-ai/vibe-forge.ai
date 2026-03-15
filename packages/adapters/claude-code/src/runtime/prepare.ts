import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/core/adapter'

import { resolveAdapterCliPath } from '../ccr/paths'

export const prepareClaudeExecution = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const { env, cwd, cache, configs: [config, userConfig] } = ctx
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

  const settings = {
    mcpServers: {
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
      ...(userConfig?.env ?? {})
    },
    companyAnnouncements: [
      ...(config?.announcements ?? []),
      ...(userConfig?.announcements ?? [])
    ],
    enabledPlugins: {
      ...(config?.enabledPlugins ?? {}),
      ...(userConfig?.enabledPlugins ?? {})
    },
    extraKnownMarketplaces: {
      ...(config?.extraKnownMarketplaces ?? {}),
      ...(userConfig?.extraKnownMarketplaces ?? {})
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

  // Routing: model with "," → CCR proxy; model without "," → native claude binary.
  //   "serviceKey,modelName" → ccr code ... --model serviceKey,modelName
  //   "opus" / undefined     → claude ... --model opus  (or omit --model)
  const useCCR = typeof model === 'string' && model.includes(',')

  let cliPath: string
  const prefixArgs: string[] = []
  if (useCCR) {
    cliPath = resolveAdapterCliPath()
    prefixArgs.push('code')
  } else {
    cliPath = 'claude'
  }

  const args: string[] = [
    ...prefixArgs,
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

  if (type === 'create') {
    args.push('--session-id', sessionId)
  } else if (type === 'resume') {
    args.push('--resume', sessionId)
  }

  if (model != null && model !== '') args.push('--model', model)

  if (systemPrompt != null && systemPrompt !== '') {
    args.push(
      appendSystemPrompt ? '--append-system-prompt' : '--system-prompt',
      systemPrompt.replace(/`/g, "'")
    )
  }

  return { cliPath: cliPath!, args, env, cwd, sessionId }
}
