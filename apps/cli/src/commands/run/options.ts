import type { Command, OptionValueSource } from 'commander'

import type { RunOptions, RunOutputFormat } from './types'

const getRunMode = (print: boolean): 'stream' | 'direct' => print ? 'stream' : 'direct'

export const getOutputFormat = (
  value: RunOutputFormat | undefined,
  source: OptionValueSource | undefined,
  fallback: RunOutputFormat
) => source === 'default' ? fallback : (value ?? 'text')

export const resolveRunMode = (
  print: boolean,
  source: OptionValueSource | undefined,
  fallback: 'stream' | 'direct'
) => source === 'default' ? fallback : getRunMode(print)

export const resolveInjectDefaultSystemPromptOption = (
  value: boolean | undefined,
  source: OptionValueSource | undefined
) => source === 'default' ? undefined : value

export const resolveDefaultVibeForgeMcpServerOption = (
  value: boolean | undefined,
  source: OptionValueSource | undefined
) => source === 'default' ? undefined : value

export const getDisallowedResumeFlags = (
  opts: RunOptions,
  command: Command
) => {
  const disallowed: string[] = []

  if (opts.adapter) disallowed.push('--adapter')
  if (opts.model) disallowed.push('--model')
  if (opts.effort) disallowed.push('--effort')
  if (opts.systemPrompt) disallowed.push('--system-prompt')
  if (opts.permissionMode) disallowed.push('--permission-mode')
  if (opts.sessionId) disallowed.push('--session-id')
  if (opts.spec) disallowed.push('--spec')
  if (opts.entity) disallowed.push('--entity')
  if (opts.workspace) disallowed.push('--workspace')
  if ((opts.includeMcpServer?.length ?? 0) > 0) disallowed.push('--include-mcp-server')
  if ((opts.excludeMcpServer?.length ?? 0) > 0) disallowed.push('--exclude-mcp-server')
  if ((opts.includeTool?.length ?? 0) > 0) disallowed.push('--include-tool')
  if ((opts.excludeTool?.length ?? 0) > 0) disallowed.push('--exclude-tool')
  if ((opts.includeSkill?.length ?? 0) > 0) disallowed.push('--include-skill')
  if ((opts.excludeSkill?.length ?? 0) > 0) disallowed.push('--exclude-skill')
  if (command.getOptionValueSource('injectDefaultSystemPrompt') !== 'default') {
    disallowed.push('--no-inject-default-system-prompt')
  }
  if (command.getOptionValueSource('defaultVibeForgeMcpServer') !== 'default') {
    disallowed.push('--no-default-vibe-forge-mcp-server')
  }

  return disallowed
}

export const mergeListConfig = (
  config: { include?: string[]; exclude?: string[] } | undefined,
  includeOpts: string[] | undefined,
  excludeOpts: string[] | undefined
) => {
  const include = config?.include || includeOpts
    ? [
      ...(config?.include ?? []),
      ...(includeOpts ?? [])
    ]
    : undefined

  const exclude = config?.exclude || excludeOpts
    ? [
      ...(config?.exclude ?? []),
      ...(excludeOpts ?? [])
    ]
    : undefined

  return include || exclude
    ? {
      include,
      exclude
    }
    : undefined
}
