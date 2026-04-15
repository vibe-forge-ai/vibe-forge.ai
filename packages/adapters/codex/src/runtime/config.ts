import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { resolveAdapterConfig as resolveMergedAdapterConfig } from '@vibe-forge/config'
import type { AdapterCtx } from '@vibe-forge/types'

import type { CodexAdapterConfig } from '#~/config-schema.js'
import { codexAdapterDeepMergeKeys, codexAdapterExtraCommonKeys } from '#~/config-schema.js'
import type { CodexSandboxPolicy } from '#~/types.js'

const MANAGED_CONFIG_BLOCK_START = '# BEGIN VIBE FORGE MANAGED CODEX CONFIG'
const MANAGED_CONFIG_BLOCK_END = '# END VIBE FORGE MANAGED CODEX CONFIG'

const MANAGED_CONFIG_BLOCK_PATTERN = new RegExp(
  `${MANAGED_CONFIG_BLOCK_START.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${
    MANAGED_CONFIG_BLOCK_END.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }\\n?`,
  'g'
)

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

export const DEFAULT_CODEX_CONFIG_OVERRIDES: Record<string, unknown> = {
  check_for_update_on_startup: false
}

export const encodeCodexConfigValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return JSON.stringify(value)
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

export const mergeCodexConfigOverrides = (overrides: Record<string, unknown>) => ({
  ...DEFAULT_CODEX_CONFIG_OVERRIDES,
  ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined))
})

export const buildNativeConfigOverrideArgs = (overrides: Record<string, unknown>) => {
  const args: string[] = []
  for (const [key, value] of Object.entries(overrides)) {
    const encoded = encodeCodexConfigValue(value)
    if (encoded == null) continue
    args.push('-c', `${key}=${encoded}`)
  }
  return args
}

type CodexRuntimeAdapterConfig = Omit<CodexAdapterConfig, 'sandboxPolicy'> & {
  sandboxPolicy?: CodexSandboxPolicy
}

export const resolveCodexAdapterConfig = (
  params: {
    configState?: AdapterCtx['configState']
    configs?: AdapterCtx['configs']
  } | undefined
) => resolveMergedAdapterConfig<CodexRuntimeAdapterConfig, typeof codexAdapterExtraCommonKeys[number]>(
  'codex',
  {
    configState: params?.configState,
    configs: params?.configs
  },
  {
    extraCommonKeys: codexAdapterExtraCommonKeys,
    deepMergeKeys: codexAdapterDeepMergeKeys
  }
)

export const resolveCodexConfigOverrides = (
  params: {
    configState?: AdapterCtx['configState']
    configs?: AdapterCtx['configs']
  } | undefined
) => {
  const { native } = resolveCodexAdapterConfig(params)
  const { configOverrides: configOverridesValue } = native

  return mergeCodexConfigOverrides(
    isPlainObject(configOverridesValue) ? configOverridesValue : {}
  )
}

const buildManagedCodexConfigBlock = (params: {
  workspacePath: string
  checkForUpdateOnStartup: unknown
}) => {
  const encodedUpdateCheck = encodeCodexConfigValue(params.checkForUpdateOnStartup) ?? 'false'

  return [
    MANAGED_CONFIG_BLOCK_START,
    '# This block is managed by Vibe Forge.',
    `check_for_update_on_startup = ${encodedUpdateCheck}`,
    '',
    `[projects.${JSON.stringify(resolve(params.workspacePath))}]`,
    'trust_level = "trusted"',
    MANAGED_CONFIG_BLOCK_END,
    ''
  ].join('\n')
}

const upsertManagedCodexConfig = (params: {
  currentContent: string
  workspacePath: string
  checkForUpdateOnStartup: unknown
}) => {
  const strippedContent = params.currentContent
    .replace(MANAGED_CONFIG_BLOCK_PATTERN, '')
    .trim()
  const managedBlock = buildManagedCodexConfigBlock({
    workspacePath: params.workspacePath,
    checkForUpdateOnStartup: params.checkForUpdateOnStartup
  })

  return strippedContent === ''
    ? managedBlock
    : `${strippedContent}\n\n${managedBlock}`
}

export const writeManagedCodexConfigFile = async (params: {
  configPath: string
  workspacePath: string
  configs: AdapterCtx['configs'] | undefined
  configState?: AdapterCtx['configState']
}) => {
  let currentContent = ''

  try {
    currentContent = await readFile(params.configPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  const configOverrides = resolveCodexConfigOverrides({
    configs: params.configs,
    configState: params.configState
  })
  const nextContent = upsertManagedCodexConfig({
    currentContent,
    workspacePath: params.workspacePath,
    checkForUpdateOnStartup: configOverrides.check_for_update_on_startup
  })

  if (nextContent === currentContent) return

  await mkdir(dirname(params.configPath), { recursive: true })
  await writeFile(params.configPath, nextContent, 'utf8')
}
