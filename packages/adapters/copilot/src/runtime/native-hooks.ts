import {
  NATIVE_HOOK_BRIDGE_ADAPTER_ENV,
  buildNodeScriptCommand,
  hasManagedHookPlugins,
  prepareManagedHookRuntime,
  resolveManagedHookScriptPath
} from '@vibe-forge/hooks'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'

export const COPILOT_NATIVE_HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'Stop'
] as const

type CopilotNativeHookEvent = (typeof COPILOT_NATIVE_HOOK_EVENTS)[number]

interface CopilotCommandHook {
  type: 'command'
  bash: string
  env?: Record<string, string>
  timeoutSec?: number
}

interface CopilotSettingsWithHooks {
  hooks?: Record<string, CopilotCommandHook[]>
}

const MANAGED_COMMAND_PATH = resolveManagedHookScriptPath('call-hook.js')
const MANAGED_COMMAND_MARKERS = [
  MANAGED_COMMAND_PATH,
  'vf-call-hook',
  'call-hook.js'
]

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const isManagedHook = (hook: unknown) => (
  isRecord(hook) &&
  typeof hook.bash === 'string' &&
  MANAGED_COMMAND_MARKERS.some(marker => (hook.bash as string).includes(marker))
)

const createHookEnv = (params: {
  ctx: Pick<AdapterCtx, 'cwd'>
  eventName: CopilotNativeHookEvent
  options: AdapterQueryOptions
}) => ({
  __VF_VIBE_FORGE_COPILOT_HOOKS_ACTIVE__: '1',
  [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'copilot',
  __VF_VIBE_FORGE_HOOK_EVENT_NAME__: params.eventName,
  __VF_PROJECT_WORKSPACE_FOLDER__: params.ctx.cwd,
  __VF_COPILOT_TASK_SESSION_ID__: params.options.sessionId,
  __VF_COPILOT_HOOK_RUNTIME__: params.options.runtime,
  ...(params.options.model != null ? { __VF_COPILOT_HOOK_MODEL__: params.options.model } : {})
})

const createManagedHook = (params: {
  command: string
  ctx: Pick<AdapterCtx, 'cwd'>
  eventName: CopilotNativeHookEvent
  options: AdapterQueryOptions
}): CopilotCommandHook => ({
  type: 'command',
  bash: params.command,
  timeoutSec: 600,
  env: createHookEnv(params)
})

export const prepareCopilotNativeHooks = (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'logger' | 'assets'>
) => {
  const { env, logger, assets } = ctx
  env.__VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__ = '0'
  const enabled = hasManagedHookPlugins({ assets }) || env.__VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__ === '1'

  try {
    const { nodePath } = prepareManagedHookRuntime(ctx)
    env.__VF_PROJECT_AI_COPILOT_HOOK_COMMAND__ = buildNodeScriptCommand({
      nodePath,
      scriptPath: MANAGED_COMMAND_PATH
    })
    env.__VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__ = enabled ? '1' : '0'
    return enabled
  } catch (error) {
    logger.warn('[copilot hooks] failed to prepare native hook bridge', error)
    env.__VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__ = '0'
    delete env.__VF_PROJECT_AI_COPILOT_HOOK_COMMAND__
    return false
  }
}

export const mergeCopilotNativeHooksIntoSettings = (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>
  options: AdapterQueryOptions
  settings: Record<string, unknown>
}) => {
  const hooks = isRecord(params.settings.hooks)
    ? params.settings.hooks as NonNullable<CopilotSettingsWithHooks['hooks']>
    : {}
  const enabled = params.ctx.env.__VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__ === '1'
  const command = params.ctx.env.__VF_PROJECT_AI_COPILOT_HOOK_COMMAND__?.trim()
  if (!enabled && Object.keys(hooks).length === 0) return params.settings

  const nextHooks: Record<string, CopilotCommandHook[]> = { ...hooks }
  const shouldInstallManagedHook = enabled && command != null && command !== ''
  const managedCommand = command ?? ''

  for (const eventName of COPILOT_NATIVE_HOOK_EVENTS) {
    const existingHooks = Array.isArray(hooks[eventName])
      ? hooks[eventName].filter(hook => !isManagedHook(hook))
      : []
    if (!shouldInstallManagedHook && existingHooks.length === 0) {
      delete nextHooks[eventName]
      continue
    }
    nextHooks[eventName] = shouldInstallManagedHook
      ? [
        ...existingHooks,
        createManagedHook({
          command: managedCommand,
          ctx: params.ctx,
          eventName,
          options: params.options
        })
      ]
      : existingHooks
  }

  return {
    ...params.settings,
    hooks: nextHooks
  }
}
