import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { Config, ModelServiceConfig } from '@vibe-forge/core'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/core/adapter'

import { buildInlineConfigContent, resolveOpenCodeModel } from '../common'
import { asPlainRecord } from '../common/object-utils'
import { ensureOpenCodeConfigDir } from './skill-config'
import { toProcessEnv, type OpenCodeAdapterConfig } from './shared'

const resolveMergedModelServices = (ctx: AdapterCtx) => ({
  ...(ctx.configs[0]?.modelServices ?? {}),
  ...(ctx.configs[1]?.modelServices ?? {})
}) as Record<string, ModelServiceConfig>

const resolveMergedMcpServers = (ctx: AdapterCtx) => ({
  ...(ctx.configs[0]?.mcpServers ?? {}),
  ...(ctx.configs[1]?.mcpServers ?? {})
}) as Config['mcpServers']

const resolveMcpServerSelection = (
  ctx: AdapterCtx,
  selection: AdapterQueryOptions['mcpServers']
) => {
  const include = selection?.include ?? Array.from(new Set([
    ...(ctx.configs[0]?.defaultIncludeMcpServers ?? []),
    ...(ctx.configs[1]?.defaultIncludeMcpServers ?? [])
  ]))
  const exclude = selection?.exclude ?? Array.from(new Set([
    ...(ctx.configs[0]?.defaultExcludeMcpServers ?? []),
    ...(ctx.configs[1]?.defaultExcludeMcpServers ?? [])
  ]))

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

export const buildChildEnv = async (params: {
  ctx: AdapterCtx
  options: AdapterQueryOptions
  adapterConfig: OpenCodeAdapterConfig
  systemPromptFile?: string
}) => {
  const configDir = await ensureOpenCodeConfigDir({ ctx: params.ctx, options: params.options })
  const { cliModel, providerConfig } = resolveOpenCodeModel(
    params.options.model,
    resolveMergedModelServices(params.ctx)
  )

  return {
    cliModel,
    env: toProcessEnv({
      ...process.env,
      ...params.ctx.env,
      OPENCODE_DISABLE_AUTOUPDATE: params.ctx.env.OPENCODE_DISABLE_AUTOUPDATE ?? 'true',
      OPENCODE_CONFIG_CONTENT: JSON.stringify(buildInlineConfigContent({
        adapterConfigContent: params.adapterConfig.configContent,
        envConfigContent: parseEnvConfigContent(params.ctx.env),
        permissionMode: params.options.permissionMode,
        tools: params.options.tools,
        mcpServers: resolveMcpServerSelection(params.ctx, params.options.mcpServers),
        availableMcpServers: resolveMergedMcpServers(params.ctx),
        systemPromptFile: params.systemPromptFile,
        providerConfig
      })),
      ...(configDir != null ? { OPENCODE_CONFIG_DIR: configDir } : {})
    })
  }
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
