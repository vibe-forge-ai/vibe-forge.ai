/* eslint-disable max-lines -- managed Codex config block parsing and write ordering are safer kept together. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { resolveAdapterConfigWithContribution as resolveMergedAdapterConfig } from '@vibe-forge/config'
import type { AdapterCtx } from '@vibe-forge/types'

import { adapterConfigContribution } from '#~/config-schema.js'
import type { CodexAdapterConfig, CodexCommonAdapterConfigKey } from '#~/config-schema.js'
import type { CodexSandboxPolicy } from '#~/types.js'

const MANAGED_ROOT_BLOCK_START = '# BEGIN VIBE FORGE MANAGED CODEX ROOT CONFIG'
const MANAGED_ROOT_BLOCK_END = '# END VIBE FORGE MANAGED CODEX ROOT CONFIG'
const MANAGED_PROJECT_BLOCK_START = '# BEGIN VIBE FORGE MANAGED CODEX PROJECT CONFIG'
const MANAGED_PROJECT_BLOCK_END = '# END VIBE FORGE MANAGED CODEX PROJECT CONFIG'
const LEGACY_MANAGED_CONFIG_BLOCK_START = '# BEGIN VIBE FORGE MANAGED CODEX CONFIG'
const LEGACY_MANAGED_CONFIG_BLOCK_END = '# END VIBE FORGE MANAGED CODEX CONFIG'

const MANAGED_ROOT_BLOCK_PATTERN = new RegExp(
  `${MANAGED_ROOT_BLOCK_START.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${
    MANAGED_ROOT_BLOCK_END.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }\\n?`,
  'g'
)

const MANAGED_PROJECT_BLOCK_PATTERN = new RegExp(
  `${MANAGED_PROJECT_BLOCK_START.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${
    MANAGED_PROJECT_BLOCK_END.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }\\n?`,
  'g'
)

const LEGACY_MANAGED_CONFIG_BLOCK_PATTERN = new RegExp(
  `${LEGACY_MANAGED_CONFIG_BLOCK_START.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${
    LEGACY_MANAGED_CONFIG_BLOCK_END.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
) =>
  resolveMergedAdapterConfig<CodexRuntimeAdapterConfig, CodexCommonAdapterConfigKey>(
    adapterConfigContribution,
    {
      configState: params?.configState,
      configs: params?.configs
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

const buildManagedCodexRootBlock = (params: {
  checkForUpdateOnStartup: unknown
}) => {
  const encodedUpdateCheck = encodeCodexConfigValue(params.checkForUpdateOnStartup) ?? 'false'

  return [
    MANAGED_ROOT_BLOCK_START,
    '# This root-level block is managed by Vibe Forge.',
    `check_for_update_on_startup = ${encodedUpdateCheck}`,
    MANAGED_ROOT_BLOCK_END,
    ''
  ].join('\n')
}

const buildManagedCodexProjectBlock = (params: {
  workspacePath: string
}) => [
  MANAGED_PROJECT_BLOCK_START,
  '# This project block is managed by Vibe Forge.',
  `[projects.${JSON.stringify(resolve(params.workspacePath))}]`,
  'trust_level = "trusted"',
  MANAGED_PROJECT_BLOCK_END,
  ''
].join('\n')

const upsertManagedRootBlock = (params: {
  currentContent: string
  checkForUpdateOnStartup: unknown
}) => {
  const strippedContent = params.currentContent
    .replace(MANAGED_ROOT_BLOCK_PATTERN, '')
    .replace(LEGACY_MANAGED_CONFIG_BLOCK_PATTERN, '')
    .trim()
  const managedBlock = buildManagedCodexRootBlock({
    checkForUpdateOnStartup: params.checkForUpdateOnStartup
  })
  const firstTableMatch = strippedContent.match(/^\s*\[/m)
  const managedProjectBlockIndex = strippedContent.indexOf(MANAGED_PROJECT_BLOCK_START)

  if (strippedContent === '') {
    return managedBlock
  }

  if (firstTableMatch == null || firstTableMatch.index == null) {
    return `${strippedContent}\n\n${managedBlock}`
  }

  const insertionIndex = managedProjectBlockIndex >= 0 && managedProjectBlockIndex < firstTableMatch.index
    ? managedProjectBlockIndex
    : firstTableMatch.index
  const beforeTables = strippedContent.slice(0, insertionIndex).trimEnd()
  const fromFirstTable = strippedContent.slice(insertionIndex).trimStart()

  return [
    beforeTables,
    managedBlock.trimEnd(),
    fromFirstTable
  ].filter(Boolean).join('\n\n')
}

const upsertManagedProjectBlock = (params: {
  currentContent: string
  workspacePath: string
}) => {
  const strippedContent = params.currentContent
    .replace(MANAGED_PROJECT_BLOCK_PATTERN, '')
    .replace(LEGACY_MANAGED_CONFIG_BLOCK_PATTERN, '')
    .trim()
  const managedBlock = buildManagedCodexProjectBlock({
    workspacePath: params.workspacePath
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
  const withManagedRootBlock = upsertManagedRootBlock({
    currentContent,
    checkForUpdateOnStartup: configOverrides.check_for_update_on_startup
  })
  const nextContent = upsertManagedProjectBlock({
    currentContent: withManagedRootBlock,
    workspacePath: params.workspacePath
  })

  if (nextContent === currentContent) return

  await mkdir(dirname(params.configPath), { recursive: true })
  await writeFile(params.configPath, nextContent, 'utf8')
}
