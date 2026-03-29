import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { AdapterCtx, AdapterQueryOptions, Config, ModelServiceConfig  } from '@vibe-forge/types'
import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'

import { buildInlineConfigContent, resolveOpenCodeModel } from '../common'
import { asPlainRecord } from '../common/object-utils'
import { toProcessEnv } from './shared'
import type { OpenCodeAdapterConfig } from './shared'
import { ensureOpenCodeConfigDir } from './skill-config'

const resolveMergedModelServices = (ctx: AdapterCtx) =>
  ({
    ...(ctx.configs[0]?.modelServices ?? {}),
    ...(ctx.configs[1]?.modelServices ?? {})
  }) as Record<string, ModelServiceConfig>

const resolveMergedMcpServers = (ctx: AdapterCtx) =>
  ({
    ...(ctx.configs[0]?.mcpServers ?? {}),
    ...(ctx.configs[1]?.mcpServers ?? {})
  }) as Config['mcpServers']

const resolveMcpServerSelection = (
  ctx: AdapterCtx,
  selection: AdapterQueryOptions['mcpServers']
) => {
  const include = selection?.include ?? Array.from(
    new Set([
      ...(ctx.configs[0]?.defaultIncludeMcpServers ?? []),
      ...(ctx.configs[1]?.defaultIncludeMcpServers ?? [])
    ])
  )
  const exclude = selection?.exclude ?? Array.from(
    new Set([
      ...(ctx.configs[0]?.defaultExcludeMcpServers ?? []),
      ...(ctx.configs[1]?.defaultExcludeMcpServers ?? [])
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
  adapterConfig: OpenCodeAdapterConfig
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
    adapterConfigContent: params.adapterConfig.configContent,
    envConfigContent: parseEnvConfigContent(params.ctx.env),
    permissionMode: params.options.permissionMode,
    tools: params.options.tools,
    mcpServers: undefined,
    availableMcpServers: params.options.assetPlan?.mcpServers ??
      mapResolvedMcpServerSelection(params.ctx, params.options),
    systemPromptFile: params.systemPromptFile,
    providerConfig
  })

  if (configDir != null) {
    const configPath = resolve(configDir, 'opencode.json')
    await rm(configPath, { force: true })
    await writeFile(configPath, `${JSON.stringify(inlineConfigContent, null, 2)}\n`, 'utf8')
  }

  return {
    cliModel,
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
        ? { OPENCODE_CONFIG_CONTENT: JSON.stringify(inlineConfigContent) }
        : {}),
      ...(configDir != null ? { OPENCODE_CONFIG_DIR: configDir } : {})
    })
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

  const promptDir = resolve(ctx.cwd, '.ai', '.mock', '.opencode-adapter', options.sessionId, 'instructions')
  const promptPath = resolve(promptDir, 'system.md')
  await mkdir(promptDir, { recursive: true })
  await writeFile(promptPath, options.systemPrompt)
  return promptPath
}
