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

const LEGACY_MANAGED_CONFIG_BLOCK_PATTERN = new RegExp(
  `${LEGACY_MANAGED_CONFIG_BLOCK_START.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${
    LEGACY_MANAGED_CONFIG_BLOCK_END.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }\\n?`,
  'g'
)

const MANAGED_PROJECT_MARKER_LINES_PATTERN = new RegExp(
  [
    `^${MANAGED_PROJECT_BLOCK_START.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    '^# This project block is managed by Vibe Forge\\.$',
    `^${MANAGED_PROJECT_BLOCK_END.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
  ].join('|'),
  'gm'
)

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const TOML_TABLE_HEADER_PATTERN = /^\s*(?:\[\[.+\]\]|\[.+\])\s*$/

interface TomlSection {
  header: string | undefined
  lines: string[]
}

type TomlStringScanState = 'none' | 'multiline-basic' | 'multiline-literal'

const normalizeTomlContent = (content: string) => content.replaceAll('\r\n', '\n')

const countConsecutiveCharacters = (content: string, startIndex: number, character: '"' | "'") => {
  let index = startIndex
  while (content[index] === character) {
    index += 1
  }
  return index - startIndex
}

const getTomlLineEndStringState = (line: string, initialState: TomlStringScanState): TomlStringScanState => {
  let state: TomlStringScanState | 'basic' | 'literal' = initialState

  for (let index = 0; index < line.length;) {
    if (state === 'none') {
      const character = line[index]
      if (character === '#') break
      if (character === '"') {
        const quoteCount = countConsecutiveCharacters(line, index, '"')
        if (quoteCount >= 3) {
          state = 'multiline-basic'
          index += 3
          continue
        }
        state = 'basic'
        index += 1
        continue
      }
      if (character === "'") {
        const quoteCount = countConsecutiveCharacters(line, index, "'")
        if (quoteCount >= 3) {
          state = 'multiline-literal'
          index += 3
          continue
        }
        state = 'literal'
        index += 1
        continue
      }
      index += 1
      continue
    }

    if (state === 'basic') {
      if (line[index] === '\\') {
        index += 2
        continue
      }
      if (line[index] === '"') {
        state = 'none'
        index += 1
        continue
      }
      index += 1
      continue
    }

    if (state === 'literal') {
      if (line[index] === "'") {
        state = 'none'
        index += 1
        continue
      }
      index += 1
      continue
    }

    if (state === 'multiline-basic') {
      const quoteCount = countConsecutiveCharacters(line, index, '"')
      if (quoteCount >= 3) {
        state = 'none'
        index += Math.min(quoteCount, 5)
        continue
      }
      if (line[index] === '\\') {
        index += 2
        continue
      }
      index += 1
      continue
    }

    const quoteCount = countConsecutiveCharacters(line, index, "'")
    if (quoteCount >= 3) {
      state = 'none'
      index += Math.min(quoteCount, 5)
      continue
    }
    index += 1
  }

  return state === 'basic' || state === 'literal' ? 'none' : state
}

const splitTomlSections = (content: string): TomlSection[] => {
  const normalizedContent = normalizeTomlContent(content)
  const lines = normalizedContent.split('\n')
  const sections: TomlSection[] = []
  let currentSection: TomlSection = {
    header: undefined,
    lines: []
  }
  let stringState: TomlStringScanState = 'none'

  for (const line of lines) {
    if (stringState === 'none' && TOML_TABLE_HEADER_PATTERN.test(line)) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection)
      }
      currentSection = {
        header: line.trim(),
        lines: [line]
      }
      stringState = getTomlLineEndStringState(line, stringState)
      continue
    }

    currentSection.lines.push(line)
    stringState = getTomlLineEndStringState(line, stringState)
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection)
  }

  return sections
}

const trimBlankLines = (lines: string[]) => {
  let start = 0
  let end = lines.length

  while (start < end && lines[start]?.trim() === '') {
    start += 1
  }
  while (end > start && lines[end - 1]?.trim() === '') {
    end -= 1
  }

  return lines.slice(start, end)
}

const joinTomlSections = (sections: TomlSection[]) => sections.map(section => section.lines.join('\n')).join('\n')

const getTomlHeaderKey = (header: string | undefined) => {
  if (header == null) return undefined
  if (header.startsWith('[[') && header.endsWith(']]')) {
    return header.slice(2, -2).trim()
  }
  if (header.startsWith('[') && header.endsWith(']')) {
    return header.slice(1, -1).trim()
  }
  return undefined
}

const isWorkspaceProjectNamespaceHeader = (header: string | undefined, workspacePath: string) => {
  const headerKey = getTomlHeaderKey(header)
  const workspaceProjectKey = `projects.${JSON.stringify(resolve(workspacePath))}`

  return headerKey === workspaceProjectKey || headerKey?.startsWith(`${workspaceProjectKey}.`) === true
}

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
  preservedProjectBodyLines?: string[]
  preservedNestedProjectSections?: string[]
}) => {
  const blockLines = [
    MANAGED_PROJECT_BLOCK_START,
    '# This project block is managed by Vibe Forge.',
    `[projects.${JSON.stringify(resolve(params.workspacePath))}]`,
    'trust_level = "trusted"',
    ...trimBlankLines(params.preservedProjectBodyLines ?? [])
  ]

  if ((params.preservedNestedProjectSections?.length ?? 0) > 0) {
    blockLines.push('')
    for (const [index, section] of (params.preservedNestedProjectSections ?? []).entries()) {
      if (index > 0) {
        blockLines.push('')
      }
      blockLines.push(...section.split('\n'))
    }
  }

  blockLines.push(
    MANAGED_PROJECT_BLOCK_END,
    ''
  )

  return blockLines.join('\n')
}

const upsertManagedRootBlock = (params: {
  currentContent: string
  checkForUpdateOnStartup: unknown
}) => {
  const strippedContent = normalizeTomlContent(params.currentContent)
    .replace(MANAGED_ROOT_BLOCK_PATTERN, '')
    .replace(LEGACY_MANAGED_CONFIG_BLOCK_PATTERN, '')
    .trim()
  const managedBlock = buildManagedCodexRootBlock({
    checkForUpdateOnStartup: params.checkForUpdateOnStartup
  })
  const sections = splitTomlSections(strippedContent)
  const firstTableSectionIndex = sections.findIndex(section => section.header != null)
  const managedProjectBlockIndex = strippedContent.indexOf(MANAGED_PROJECT_BLOCK_START)

  if (strippedContent === '') {
    return managedBlock
  }

  if (firstTableSectionIndex < 0) {
    return `${strippedContent}\n\n${managedBlock}`
  }

  const firstTableHeader = sections[firstTableSectionIndex]?.header
  const firstTableIndex = firstTableHeader == null
    ? -1
    : strippedContent.indexOf(firstTableHeader)
  const insertionIndex =
    managedProjectBlockIndex >= 0 && (firstTableIndex < 0 || managedProjectBlockIndex < firstTableIndex)
      ? managedProjectBlockIndex
      : firstTableIndex
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
  const strippedManagedContent = normalizeTomlContent(params.currentContent)
    .replace(MANAGED_PROJECT_MARKER_LINES_PATTERN, '')
    .replace(LEGACY_MANAGED_CONFIG_BLOCK_PATTERN, '')
  const sections = splitTomlSections(strippedManagedContent)
  const preservedProjectBodyLines: string[] = []
  const preservedNestedProjectSections: string[] = []
  const strippedContent = sections
    .filter((section) => {
      if (!isWorkspaceProjectNamespaceHeader(section.header, params.workspacePath)) {
        return true
      }

      const headerKey = getTomlHeaderKey(section.header)
      const workspaceProjectKey = `projects.${JSON.stringify(resolve(params.workspacePath))}`
      if (headerKey === workspaceProjectKey) {
        preservedProjectBodyLines.push(
          ...trimBlankLines(section.lines.slice(1)).filter(line => !/^\s*trust_level\s*=/.test(line))
        )
      } else {
        preservedNestedProjectSections.push(trimBlankLines(section.lines).join('\n'))
      }

      return false
    })
    .map(section => section.lines.join('\n'))
    .join('\n')
    .trim()
  const managedBlock = buildManagedCodexProjectBlock({
    workspacePath: params.workspacePath,
    preservedProjectBodyLines,
    preservedNestedProjectSections
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
