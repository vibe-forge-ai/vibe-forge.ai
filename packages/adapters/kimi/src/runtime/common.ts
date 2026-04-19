/* eslint-disable max-lines */

import type { ChatMessageContent } from '@vibe-forge/core'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'
import { omitAdapterCommonConfig } from '@vibe-forge/utils'

import type { KimiAdapterConfig } from '../config-schema'

export type { KimiAdapterConfig } from '../config-schema'

export type KimiProviderType =
  | 'kimi'
  | 'openai_legacy'
  | 'openai_responses'
  | 'anthropic'
  | 'gemini'
  | 'vertexai'

export const DEFAULT_KIMI_TOOL_REFS = [
  'kimi_cli.tools.agent:Agent',
  'kimi_cli.tools.ask_user:AskUserQuestion',
  'kimi_cli.tools.todo:SetTodoList',
  'kimi_cli.tools.shell:Shell',
  'kimi_cli.tools.background:TaskList',
  'kimi_cli.tools.background:TaskOutput',
  'kimi_cli.tools.background:TaskStop',
  'kimi_cli.tools.file:ReadFile',
  'kimi_cli.tools.file:ReadMediaFile',
  'kimi_cli.tools.file:Glob',
  'kimi_cli.tools.file:Grep',
  'kimi_cli.tools.file:WriteFile',
  'kimi_cli.tools.file:StrReplaceFile',
  'kimi_cli.tools.web:SearchWeb',
  'kimi_cli.tools.web:FetchURL',
  'kimi_cli.tools.plan:ExitPlanMode',
  'kimi_cli.tools.plan.enter:EnterPlanMode'
] as const

const KIMI_TOOL_REF_BY_NAME = {
  Agent: 'kimi_cli.tools.agent:Agent',
  AskUserQuestion: 'kimi_cli.tools.ask_user:AskUserQuestion',
  SetTodoList: 'kimi_cli.tools.todo:SetTodoList',
  Shell: 'kimi_cli.tools.shell:Shell',
  TaskList: 'kimi_cli.tools.background:TaskList',
  TaskOutput: 'kimi_cli.tools.background:TaskOutput',
  TaskStop: 'kimi_cli.tools.background:TaskStop',
  ReadFile: 'kimi_cli.tools.file:ReadFile',
  ReadMediaFile: 'kimi_cli.tools.file:ReadMediaFile',
  Glob: 'kimi_cli.tools.file:Glob',
  Grep: 'kimi_cli.tools.file:Grep',
  WriteFile: 'kimi_cli.tools.file:WriteFile',
  StrReplaceFile: 'kimi_cli.tools.file:StrReplaceFile',
  SearchWeb: 'kimi_cli.tools.web:SearchWeb',
  FetchURL: 'kimi_cli.tools.web:FetchURL',
  ExitPlanMode: 'kimi_cli.tools.plan:ExitPlanMode',
  EnterPlanMode: 'kimi_cli.tools.plan.enter:EnterPlanMode'
} as const satisfies Record<string, string>

export const DEFAULT_KIMI_TOOLS = Object.keys(KIMI_TOOL_REF_BY_NAME)

const asPlainRecord = (value: unknown): Record<string, unknown> | undefined => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
)

export const normalizeStringRecord = (value: unknown) => (
  Object.fromEntries(
    Object.entries(asPlainRecord(value) ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
  )
)

export const deepMerge = (
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> => {
  const next = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const currentRecord = asPlainRecord(next[key])
    const valueRecord = asPlainRecord(value)
    next[key] = currentRecord != null && valueRecord != null
      ? deepMerge(currentRecord, valueRecord)
      : value
  }
  return next
}

export const resolveAdapterConfig = (ctx: AdapterCtx): KimiAdapterConfig => {
  const [config, userConfig] = ctx.configs
  return omitAdapterCommonConfig({
    ...(config?.adapters?.kimi ?? {}),
    ...(userConfig?.adapters?.kimi ?? {})
  }) as KimiAdapterConfig
}

export const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error ?? 'Kimi session failed unexpectedly')
)

export const toAdapterErrorData = (
  error: unknown,
  overrides: Partial<{ message: string; code: string; details: unknown; fatal: boolean }> = {}
) => ({
  message: overrides.message ?? getErrorMessage(error),
  ...(overrides.code != null ? { code: overrides.code } : {}),
  ...(overrides.details !== undefined ? { details: overrides.details } : {}),
  fatal: overrides.fatal ?? true
})

export const toProcessEnv = (env: Record<string, string | null | undefined>) => (
  Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
)

const describePromptPart = (item: ChatMessageContent): string | undefined => {
  switch (item.type) {
    case 'text':
      return item.text.trim() === '' ? undefined : item.text
    case 'image':
      return item.name?.trim() ? `[Image: ${item.name.trim()}]` : '[Image attachment]'
    case 'file':
      return item.name?.trim()
        ? `Context file: ${item.name.trim()} (${item.path})`
        : `Context file: ${item.path}`
    default:
      return undefined
  }
}

export const normalizePromptContent = (content: ChatMessageContent[]) => {
  const parts = content
    .map(describePromptPart)
    .filter((value): value is string => value != null)

  return parts.length > 0 ? parts.join('\n\n') : undefined
}

export const resolveRequestedThinking = (
  effort: AdapterQueryOptions['effort'],
  adapterConfig: KimiAdapterConfig
) => (
  effort != null
    ? effort !== 'low'
    : adapterConfig.thinking
)

export const resolveSelectedToolRefs = (selection: AdapterQueryOptions['tools']) => {
  if (selection == null) return undefined

  const included = selection.include != null && selection.include.length > 0
    ? selection.include
    : DEFAULT_KIMI_TOOLS
  const excluded = new Set(selection.exclude ?? [])

  return included
    .filter(name => !excluded.has(name))
    .flatMap(name => {
      const ref = KIMI_TOOL_REF_BY_NAME[name as keyof typeof KIMI_TOOL_REF_BY_NAME]
      return ref != null ? [ref] : []
    })
}

export const resolveReportedToolNames = (
  selection: AdapterQueryOptions['tools'],
  agentName?: string
) => {
  const selectedRefs = resolveSelectedToolRefs(selection)
  const selectedNames = selectedRefs == null
    ? [...DEFAULT_KIMI_TOOLS]
    : selectedRefs.map((ref) => ref.split(':').at(-1) ?? ref)

  if (agentName === 'okabe' && !selectedNames.includes('SendDMail')) {
    selectedNames.unshift('SendDMail')
  }

  return selectedNames
}

export const buildKimiAgentFileContent = (params: {
  agent?: string
  systemPrompt?: string
  tools?: AdapterQueryOptions['tools']
}) => {
  const normalizedPrompt = params.systemPrompt?.trim()
  const baseAgent = params.agent?.trim() || 'default'
  const selectedToolRefs = resolveSelectedToolRefs(params.tools)
  const needsCustomAgent = (normalizedPrompt != null && normalizedPrompt !== '') || selectedToolRefs != null

  if (!needsCustomAgent) return undefined

  const lines = [
    'version: 1',
    'agent:',
    `  extend: ${baseAgent}`,
    '  name: vibe-forge-kimi'
  ]

  if (normalizedPrompt != null && normalizedPrompt !== '') {
    lines.push('  system_prompt_path: ./system.md')
  }

  if (selectedToolRefs != null) {
    lines.push('  tools:')
    for (const ref of selectedToolRefs) {
      lines.push(`    - ${JSON.stringify(ref)}`)
    }
  }

  return `${lines.join('\n')}\n`
}
