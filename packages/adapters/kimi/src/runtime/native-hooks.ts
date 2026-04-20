import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import { buildNodeScriptCommand, hasManagedHookPlugins, prepareManagedHookRuntime } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

const require = createRequire(import.meta.url ?? __filename)
const adapterPackageDir = dirname(require.resolve('@vibe-forge/adapter-kimi/package.json'))

export const KIMI_NATIVE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PreCompact',
  'Stop'
] as const

type KimiNativeHookEvent = (typeof KIMI_NATIVE_HOOK_EVENTS)[number]

interface KimiNativeHookEntry {
  event: KimiNativeHookEvent
  matcher?: string
  command: string
  timeout: number
}

const KIMI_HOOK_TIMEOUT_SECONDS = 600
const MANAGED_HOOK_SCRIPT_PATH = resolve(adapterPackageDir, 'kimi-hook.js')
const MANAGED_COMMAND_MARKERS = [
  MANAGED_HOOK_SCRIPT_PATH,
  'kimi-hook.js',
  'vf-kimi-hook'
]
const MANAGED_TOML_START = '# Vibe Forge managed Kimi hooks start'
const MANAGED_TOML_END = '# Vibe Forge managed Kimi hooks end'

const isPlainRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const isManagedHookEntry = (entry: unknown) => (
  isPlainRecord(entry) &&
  (() => {
    const command = entry.command
    return typeof command === 'string' && MANAGED_COMMAND_MARKERS.some(marker => command.includes(marker))
  })()
)

const escapeTomlString = (value: string) => JSON.stringify(value)

const buildKimiNativeHookCommand = (nodePath: string) =>
  buildNodeScriptCommand({
    nodePath,
    scriptPath: MANAGED_HOOK_SCRIPT_PATH
  })

export const buildKimiNativeHookEntries = (command: string): KimiNativeHookEntry[] => (
  KIMI_NATIVE_HOOK_EVENTS.map(event => ({
    event,
    ...(event === 'PreToolUse' || event === 'PostToolUse' ? { matcher: '.*' } : {}),
    command,
    timeout: KIMI_HOOK_TIMEOUT_SECONDS
  }))
)

export const mergeKimiNativeHooksIntoJsonConfig = (params: {
  config: Record<string, unknown>
  enabled: boolean
  command: string
}) => {
  const { hooks: _hooks, ...rest } = params.config
  const existingHooks = Array.isArray(params.config.hooks)
    ? params.config.hooks.filter(entry => !isManagedHookEntry(entry))
    : []
  const hooks = params.enabled
    ? [...existingHooks, ...buildKimiNativeHookEntries(params.command)]
    : existingHooks

  return {
    ...rest,
    ...(hooks.length > 0 ? { hooks } : {})
  }
}

export const mergeKimiNativeHooksIntoTomlConfig = (params: {
  content: string
  enabled: boolean
  command: string
}) => {
  const stripped = params.content
    .replace(
      new RegExp(
        `\\n?${MANAGED_TOML_START.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')}[\\s\\S]*?${
          MANAGED_TOML_END.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
        }\\n?`,
        'u'
      ),
      '\n'
    )
    .trimEnd()

  if (!params.enabled) return stripped === '' ? '' : `${stripped}\n`

  const block = [
    MANAGED_TOML_START,
    ...buildKimiNativeHookEntries(params.command).flatMap(entry => [
      '[[hooks]]',
      `event = ${escapeTomlString(entry.event)}`,
      ...(entry.matcher != null ? [`matcher = ${escapeTomlString(entry.matcher)}`] : []),
      `command = ${escapeTomlString(entry.command)}`,
      `timeout = ${entry.timeout}`,
      ''
    ]),
    MANAGED_TOML_END
  ].join('\n')

  return `${stripped === '' ? '' : `${stripped}\n\n`}${block}\n`
}

export const prepareKimiNativeHooks = (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'logger' | 'assets'>
) => {
  const { env, logger, assets } = ctx
  env.__VF_PROJECT_AI_KIMI_NATIVE_HOOKS_AVAILABLE__ = '0'
  const enabled = hasManagedHookPlugins({ assets }) || env.__VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__ === '1'

  try {
    const { nodePath } = prepareManagedHookRuntime(ctx)
    env.__VF_PROJECT_AI_KIMI_NATIVE_HOOKS_AVAILABLE__ = enabled ? '1' : '0'
    env.__VF_PROJECT_AI_KIMI_HOOK_COMMAND__ = buildKimiNativeHookCommand(nodePath)
    return enabled
  } catch (error) {
    logger.warn('[kimi hooks] failed to prepare native hook bridge', error)
    env.__VF_PROJECT_AI_KIMI_NATIVE_HOOKS_AVAILABLE__ = '0'
    delete env.__VF_PROJECT_AI_KIMI_HOOK_COMMAND__
    return false
  }
}
