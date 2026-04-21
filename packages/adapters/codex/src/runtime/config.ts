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

const MANAGED_PROJECT_BLOCK_COMMENT = '# This project block is managed by Vibe Forge.'

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

interface TomlSection {
  header: string | undefined
  lines: string[]
  startLine: number
  endLine: number
  startOffset: number
  endOffset: number
}

interface TomlLine {
  text: string
  startOffset: number
  endOffset: number
  stringStateBefore: TomlStringScanState
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

const parseTomlTableHeaderLine = (line: string): string | undefined => {
  let startIndex = 0
  while (startIndex < line.length && /\s/.test(line[startIndex] ?? '')) {
    startIndex += 1
  }

  if (line[startIndex] !== '[') return undefined

  const isArrayTable = line[startIndex + 1] === '['
  let quoteState: 'none' | 'basic' | 'literal' = 'none'
  let index = startIndex + (isArrayTable ? 2 : 1)

  for (; index < line.length; index += 1) {
    const character = line[index]

    if (quoteState === 'none') {
      if (character === '#') return undefined
      if (character === '"') {
        quoteState = 'basic'
        continue
      }
      if (character === "'") {
        quoteState = 'literal'
        continue
      }
      if (!isArrayTable && character === ']') {
        index += 1
        break
      }
      if (isArrayTable && character === ']' && line[index + 1] === ']') {
        index += 2
        break
      }
      continue
    }

    if (quoteState === 'basic') {
      if (character === '\\') {
        index += 1
        continue
      }
      if (character === '"') {
        quoteState = 'none'
      }
      continue
    }

    if (character === "'") {
      quoteState = 'none'
    }
  }

  if (quoteState !== 'none') return undefined

  const header = line.slice(startIndex, index).trim()
  if (header === '' || !header.endsWith(isArrayTable ? ']]' : ']')) return undefined
  if (!/^\s*(?:#.*)?$/.test(line.slice(index))) return undefined

  return header
}

const scanTomlSections = (content: string): {
  lines: TomlLine[]
  sections: TomlSection[]
} => {
  const normalizedContent = normalizeTomlContent(content)
  const rawLines = normalizedContent.split('\n')
  const lines: TomlLine[] = []
  const sections: TomlSection[] = []
  let currentSection: TomlSection = {
    header: undefined,
    lines: [],
    startLine: 0,
    endLine: 0,
    startOffset: 0,
    endOffset: 0
  }
  let stringState: TomlStringScanState = 'none'
  let offset = 0

  for (const [lineIndex, line] of rawLines.entries()) {
    const lineStartOffset = offset
    const lineEndOffset = lineStartOffset + line.length + (lineIndex < rawLines.length - 1 ? 1 : 0)
    lines.push({
      text: line,
      startOffset: lineStartOffset,
      endOffset: lineEndOffset,
      stringStateBefore: stringState
    })

    const header = stringState === 'none' ? parseTomlTableHeaderLine(line) : undefined
    if (header != null) {
      if (currentSection.lines.length > 0) {
        currentSection.endLine = lineIndex
        currentSection.endOffset = lineStartOffset
        sections.push(currentSection)
      }
      currentSection = {
        header,
        lines: [line],
        startLine: lineIndex,
        endLine: lineIndex + 1,
        startOffset: lineStartOffset,
        endOffset: lineEndOffset
      }
      stringState = getTomlLineEndStringState(line, stringState)
      offset = lineEndOffset
      continue
    }

    if (currentSection.lines.length === 0) {
      currentSection.startLine = lineIndex
      currentSection.startOffset = lineStartOffset
    }
    currentSection.lines.push(line)
    stringState = getTomlLineEndStringState(line, stringState)
    offset = lineEndOffset
  }

  if (currentSection.lines.length > 0) {
    currentSection.endLine = rawLines.length
    currentSection.endOffset = normalizedContent.length
    sections.push(currentSection)
  }

  return {
    lines,
    sections
  }
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

const isManagedProjectMarkerLine = (line: string) => {
  const trimmedLine = line.trim()
  return trimmedLine === MANAGED_PROJECT_BLOCK_START ||
    trimmedLine === MANAGED_PROJECT_BLOCK_COMMENT ||
    trimmedLine === MANAGED_PROJECT_BLOCK_END
}

const findManagedProjectPreambleStartLine = (lines: TomlLine[]) =>
  lines.findIndex((line, lineIndex) =>
    line.stringStateBefore === 'none' &&
    line.text.trim() === MANAGED_PROJECT_BLOCK_START &&
    lines[lineIndex + 1]?.stringStateBefore === 'none' &&
    lines[lineIndex + 1]?.text.trim() === MANAGED_PROJECT_BLOCK_COMMENT
  )

const findManagedProjectPreambleLineNumbers = (lines: TomlLine[], headerLineIndex: number) => {
  let candidateLineIndex = headerLineIndex - 1
  while (candidateLineIndex >= 0 && lines[candidateLineIndex]?.text.trim() === '') {
    candidateLineIndex -= 1
  }

  if (
    candidateLineIndex >= 1 &&
    lines[candidateLineIndex]?.stringStateBefore === 'none' &&
    lines[candidateLineIndex - 1]?.stringStateBefore === 'none' &&
    lines[candidateLineIndex]?.text.trim() === MANAGED_PROJECT_BLOCK_COMMENT &&
    lines[candidateLineIndex - 1]?.text.trim() === MANAGED_PROJECT_BLOCK_START
  ) {
    return [candidateLineIndex - 1, candidateLineIndex]
  }

  return []
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
    MANAGED_PROJECT_BLOCK_COMMENT,
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
  const scan = scanTomlSections(strippedContent)
  const firstTableSection = scan.sections.find(section => section.header != null)
  const managedProjectPreambleLineIndex = findManagedProjectPreambleStartLine(scan.lines)

  if (strippedContent === '') {
    return managedBlock
  }

  if (firstTableSection == null) {
    return `${strippedContent}\n\n${managedBlock}`
  }

  const insertionIndex = managedProjectPreambleLineIndex >= 0
    ? Math.min(
      firstTableSection.startOffset,
      scan.lines[managedProjectPreambleLineIndex]?.startOffset ?? firstTableSection.startOffset
    )
    : firstTableSection.startOffset
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
    .replace(LEGACY_MANAGED_CONFIG_BLOCK_PATTERN, '')
  const scan = scanTomlSections(strippedManagedContent)
  const preservedProjectBodyLines: string[] = []
  const preservedNestedProjectSections: string[] = []
  const skippedLineNumbers = new Set<number>()

  for (const section of scan.sections) {
    if (!isWorkspaceProjectNamespaceHeader(section.header, params.workspacePath)) {
      continue
    }

    for (let lineIndex = section.startLine; lineIndex < section.endLine; lineIndex += 1) {
      skippedLineNumbers.add(lineIndex)
    }

    const headerKey = getTomlHeaderKey(section.header)
    const workspaceProjectKey = `projects.${JSON.stringify(resolve(params.workspacePath))}`
    const normalizedSectionLines = trimBlankLines(section.lines.filter(line => !isManagedProjectMarkerLine(line)))

    if (headerKey === workspaceProjectKey) {
      for (const lineIndex of findManagedProjectPreambleLineNumbers(scan.lines, section.startLine)) {
        skippedLineNumbers.add(lineIndex)
      }

      preservedProjectBodyLines.push(
        ...trimBlankLines(normalizedSectionLines.slice(1)).filter(line => !/^\s*trust_level\s*=/.test(line))
      )
      continue
    }

    preservedNestedProjectSections.push(normalizedSectionLines.join('\n'))
  }

  const strippedContent = scan.lines
    .filter((_, lineIndex) => !skippedLineNumbers.has(lineIndex))
    .map(line => line.text)
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
