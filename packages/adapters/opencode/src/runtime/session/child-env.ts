import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { resolveConfigState } from '@vibe-forge/config'
import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'
import type { AdapterCtx, AdapterQueryOptions, Config, ModelServiceConfig } from '@vibe-forge/types'
import { resolveProjectAiPath } from '@vibe-forge/utils'

import { buildInlineConfigContent, resolveOpenCodeModel } from '../common'
import { asPlainRecord, deepMerge } from '../common/object-utils'
import { toProcessEnv } from './shared'
import type { OpenCodeResolvedAdapterConfig } from './shared'
import { ensureOpenCodeConfigDir } from './skill-config'

const resolveMergedConfig = (ctx: AdapterCtx) =>
  resolveConfigState({
    configState: ctx.configState,
    configs: ctx.configs
  }).mergedConfig

const resolveMergedModelServices = (ctx: AdapterCtx) =>
  (resolveMergedConfig(ctx).modelServices ?? {}) as Record<string, ModelServiceConfig>

const resolveMergedMcpServers = (ctx: AdapterCtx) => resolveMergedConfig(ctx).mcpServers as Config['mcpServers']

const resolveManagedPermissions = (ctx: AdapterCtx): Config['permissions'] => {
  const permissions = resolveMergedConfig(ctx).permissions
  return {
    allow: [...(permissions?.allow ?? [])],
    deny: [...(permissions?.deny ?? [])],
    ask: [...(permissions?.ask ?? [])]
  }
}

const resolveMcpServerSelection = (
  ctx: AdapterCtx,
  selection: AdapterQueryOptions['mcpServers']
) => {
  const mergedConfig = resolveMergedConfig(ctx)
  const include = selection?.include ?? Array.from(
    new Set([
      ...(mergedConfig.defaultIncludeMcpServers ?? [])
    ])
  )
  const exclude = selection?.exclude ?? Array.from(
    new Set([
      ...(mergedConfig.defaultExcludeMcpServers ?? [])
    ])
  )

  return include.length > 0 || exclude.length > 0
    ? {
      include: include.length > 0 ? include : undefined,
      exclude: exclude.length > 0 ? exclude : undefined
    }
    : undefined
}

const parseEnvConfigContent = (env: AdapterCtx['env']) => {
  const raw = env.OPENCODE_CONFIG_CONTENT
  if (typeof raw !== 'string' || raw.trim() === '') return undefined

  try {
    const parsed = JSON.parse(raw)
    return asPlainRecord(parsed)
  } catch {
    return undefined
  }
}

const readBaseConfigContent = async (configDir: string | undefined) => {
  if (configDir == null) return undefined

  try {
    const parsed = JSON.parse(await readFile(resolve(configDir, 'opencode.json'), 'utf8'))
    return asPlainRecord(parsed)
  } catch {
    return undefined
  }
}

export const buildChildEnv = async (params: {
  ctx: AdapterCtx
  options: AdapterQueryOptions
  adapterConfig: OpenCodeResolvedAdapterConfig
  systemPromptFile?: string
}) => {
  const configDir = await ensureOpenCodeConfigDir({ ctx: params.ctx, options: params.options })
  const nativeHooksAvailable = params.ctx.env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ === '1'
  const baseConfigContent = await readBaseConfigContent(configDir)
  const { cliModel, providerConfig } = resolveOpenCodeModel(
    params.options.model,
    resolveMergedModelServices(params.ctx)
  )
  const inlineConfigContent = buildInlineConfigContent({
    baseConfigContent,
    adapterConfigContent: params.adapterConfig.native.configContent,
    envConfigContent: parseEnvConfigContent(params.ctx.env),
    permissionMode: params.options.permissionMode,
    tools: params.options.tools,
    mcpServers: undefined,
    availableMcpServers: params.options.assetPlan?.mcpServers ??
      mapResolvedMcpServerSelection(params.ctx, params.options),
    managedPermissions: resolveManagedPermissions(params.ctx),
    systemPromptFile: params.systemPromptFile,
    providerConfig
  })
  const requestedEffort = params.options.effort ?? params.adapterConfig.common.effort
  const effortConfig = buildOpenCodeEffortConfig({
    cliModel,
    rawModel: params.options.model,
    effort: requestedEffort,
    inlineConfigContent
  })
  const finalConfigContent = effortConfig.patch == null
    ? inlineConfigContent
    : deepMerge(inlineConfigContent, effortConfig.patch)

  if (configDir != null) {
    const configPath = resolve(configDir, 'opencode.json')
    await rm(configPath, { force: true })
    await writeFile(configPath, `${JSON.stringify(finalConfigContent, null, 2)}\n`, 'utf8')
  }

  return {
    cliModel,
    effort: effortConfig.effectiveEffort,
    env: toProcessEnv({
      ...process.env,
      ...params.ctx.env,
      OPENCODE_DISABLE_AUTOUPDATE: params.ctx.env.OPENCODE_DISABLE_AUTOUPDATE ?? 'true',
      ...(nativeHooksAvailable
        ? {
          __VF_VIBE_FORGE_OPENCODE_HOOKS_ACTIVE__: '1',
          [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'opencode',
          __VF_OPENCODE_HOOK_RUNTIME__: params.options.runtime,
          __VF_OPENCODE_TASK_SESSION_ID__: params.options.sessionId
        }
        : {}),
      ...(configDir == null
        ? { OPENCODE_CONFIG_CONTENT: JSON.stringify(finalConfigContent) }
        : {}),
      ...(configDir != null ? { OPENCODE_CONFIG_DIR: configDir } : {})
    })
  }
}

const OPENAI_EFFORT_MAP = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  max: 'xhigh'
} as const

const GEMINI_BUDGET_MAP = {
  low: 2048,
  medium: 8192,
  high: 16384,
  max: 32768
} as const

const normalizeEffort = (value: unknown): AdapterQueryOptions['effort'] => (
  value === 'low' || value === 'medium' || value === 'high' || value === 'max'
    ? value
    : undefined
)

const resolveOpenCodeModelTarget = (value: string | undefined) => {
  const normalized = value?.trim()
  if (normalized == null || normalized === '' || normalized === 'default') return undefined
  if (normalized.includes('/')) {
    const slashIndex = normalized.indexOf('/')
    const provider = normalized.slice(0, slashIndex).trim()
    const model = normalized.slice(slashIndex + 1).trim()
    if (provider !== '' && model !== '') {
      return { provider, model }
    }
  }

  if (normalized.startsWith('gpt-') || normalized.startsWith('o')) {
    return { provider: 'openai', model: normalized }
  }
  if (normalized.startsWith('claude')) {
    return { provider: 'anthropic', model: normalized }
  }
  if (normalized.startsWith('gemini')) {
    return { provider: 'google', model: normalized }
  }

  return undefined
}

const getProviderModelOptions = (
  config: Record<string, unknown>,
  target: { provider: string; model: string }
) => {
  const provider = asPlainRecord(asPlainRecord(config.provider)?.[target.provider])
  const model = asPlainRecord(asPlainRecord(provider?.models)?.[target.model])
  return asPlainRecord(model?.options)
}

const resolveExistingOpenCodeEffort = (
  config: Record<string, unknown>,
  target: { provider: string; model: string }
): AdapterQueryOptions['effort'] => {
  const options = getProviderModelOptions(config, target)
  if (options == null) return undefined

  if (typeof options.reasoningEffort === 'string') {
    if (options.reasoningEffort === 'xhigh') return 'max'
    return normalizeEffort(options.reasoningEffort)
  }
  if (typeof options.effort === 'string') {
    return normalizeEffort(options.effort)
  }
  const thinking = asPlainRecord(options.thinking)
  if (thinking?.type === 'enabled' && typeof thinking.budgetTokens === 'number') {
    return 'max'
  }
  const thinkingConfig = asPlainRecord(options.thinkingConfig)
  if (typeof thinkingConfig?.thinkingLevel === 'string') {
    if (thinkingConfig.thinkingLevel === 'high') return 'max'
    return thinkingConfig.thinkingLevel === 'medium'
      ? 'medium'
      : thinkingConfig.thinkingLevel === 'low'
      ? 'low'
      : undefined
  }
  if (typeof thinkingConfig?.thinkingBudget === 'number') {
    if (thinkingConfig.thinkingBudget >= GEMINI_BUDGET_MAP.max) return 'max'
    if (thinkingConfig.thinkingBudget >= GEMINI_BUDGET_MAP.high) return 'high'
    if (thinkingConfig.thinkingBudget >= GEMINI_BUDGET_MAP.medium) return 'medium'
    return 'low'
  }

  return undefined
}

const buildProviderPatch = (
  target: { provider: string; model: string },
  options: Record<string, unknown>
) => ({
  provider: {
    [target.provider]: {
      models: {
        [target.model]: {
          options
        }
      }
    }
  }
})

const buildOpenCodeEffortConfig = (params: {
  cliModel?: string
  rawModel?: string
  effort?: AdapterQueryOptions['effort']
  inlineConfigContent: Record<string, unknown>
}) => {
  const effort = normalizeEffort(params.effort)
  if (effort == null) {
    return {
      patch: undefined,
      effectiveEffort: undefined as AdapterQueryOptions['effort']
    }
  }

  const target = resolveOpenCodeModelTarget(params.cliModel ?? params.rawModel)
  if (target == null) {
    return {
      patch: undefined,
      effectiveEffort: undefined as AdapterQueryOptions['effort']
    }
  }

  const existingEffort = resolveExistingOpenCodeEffort(params.inlineConfigContent, target)
  if (existingEffort != null) {
    return {
      patch: undefined,
      effectiveEffort: existingEffort
    }
  }

  if (target.provider === 'openai') {
    return {
      patch: buildProviderPatch(target, { reasoningEffort: OPENAI_EFFORT_MAP[effort] }),
      effectiveEffort: effort
    }
  }

  if (target.provider === 'anthropic') {
    return effort === 'max'
      ? {
        patch: buildProviderPatch(target, {
          thinking: {
            type: 'enabled',
            budgetTokens: 32000
          }
        }),
        effectiveEffort: effort
      }
      : {
        patch: buildProviderPatch(target, { effort }),
        effectiveEffort: effort
      }
  }

  if (target.provider === 'google') {
    return target.model.includes('2.5')
      ? {
        patch: buildProviderPatch(target, {
          thinkingConfig: {
            thinkingBudget: GEMINI_BUDGET_MAP[effort]
          }
        }),
        effectiveEffort: effort
      }
      : {
        patch: buildProviderPatch(target, {
          thinkingConfig: {
            thinkingLevel: effort === 'max' ? 'high' : effort
          }
        }),
        effectiveEffort: effort
      }
  }

  return {
    patch: undefined,
    effectiveEffort: undefined as AdapterQueryOptions['effort']
  }
}

const mapResolvedMcpServerSelection = (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
) => (
  options.assetPlan?.mcpServers ?? mapSelectedMcpServersToConfig(
    resolveMergedMcpServers(ctx),
    resolveMcpServerSelection(ctx, options.mcpServers)
  )
)

const mapSelectedMcpServersToConfig = (
  availableMcpServers: Config['mcpServers'],
  selection: AdapterQueryOptions['mcpServers']
) => {
  if (availableMcpServers == null) return undefined
  const include = selection?.include != null ? new Set(selection.include) : undefined
  const exclude = new Set(selection?.exclude ?? [])

  return Object.fromEntries(
    Object.entries(availableMcpServers).filter(([name]) => {
      if (include != null && !include.has(name)) return false
      if (exclude.has(name)) return false
      return true
    })
  )
}

export const ensureSystemPromptFile = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
) => {
  if (options.systemPrompt == null || options.systemPrompt.trim() === '') return undefined

  const promptDir = resolveProjectAiPath(
    ctx.cwd,
    ctx.env,
    '.mock',
    '.opencode-adapter',
    options.sessionId,
    'instructions'
  )
  const promptPath = resolve(promptDir, 'system.md')
  await mkdir(promptDir, { recursive: true })
  await writeFile(promptPath, options.systemPrompt)
  return promptPath
}
