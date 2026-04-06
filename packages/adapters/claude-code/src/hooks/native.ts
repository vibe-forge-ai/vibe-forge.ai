import { resolve } from 'node:path'

import {
  buildNodeScriptCommand,
  hasManagedHookPlugins,
  mergeManagedHookGroups,
  prepareManagedHookRuntime,
  readJsonFileOrDefault,
  resolveManagedHookScriptPath,
  writeJsonFile
} from '@vibe-forge/hooks'
import type { NativeHookMatcherGroup } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

export const CLAUDE_NATIVE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'PreCompact'
] as const

type ClaudeNativeHookEvent = (typeof CLAUDE_NATIVE_HOOK_EVENTS)[number]

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const MANAGED_COMMAND_PATH = resolveManagedHookScriptPath('call-hook.js')
const MANAGED_COMMAND_MARKERS = [
  MANAGED_COMMAND_PATH,
  'vf-call-hook',
  'claude-hook.js',
  'call-hook.js'
]

const isManagedGroup = (group: NativeHookMatcherGroup) => (
  Array.isArray(group.hooks) &&
  group.hooks.some(hook => MANAGED_COMMAND_MARKERS.some(marker => hook.command.includes(marker)))
)

const createManagedGroup = (
  command: string,
  eventName: ClaudeNativeHookEvent
): NativeHookMatcherGroup => ({
  ...(eventName === 'PreToolUse' || eventName === 'PostToolUse'
    ? { matcher: '.*' }
    : {}),
  hooks: [{
    type: 'command',
    command,
    timeout: 600,
    statusMessage: `running vibe-forge ${eventName} hook`
  }]
})

export const ensureClaudeNativeHooksInstalled = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'logger' | 'assets'>
) => {
  const { env, logger, assets } = ctx

  env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ = '0'
  const enabled = hasManagedHookPlugins({ assets }) || env.__VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__ === '1'

  try {
    const { mockHome, nodePath } = prepareManagedHookRuntime(ctx)
    const settingsPath = resolve(mockHome, '.claude', 'settings.json')
    const projectSettingsPath = resolve(ctx.cwd, '.claude', 'settings.json')
    const existing = await readJsonFileOrDefault<unknown>(settingsPath, {})
    const projectSettings = await readJsonFileOrDefault<unknown>(projectSettingsPath, {})
    const projectSettingsHooks = isRecord(projectSettings) && isRecord(projectSettings.hooks)
      ? projectSettings.hooks
      : undefined
    const projectManagedEvents = new Set<ClaudeNativeHookEvent>(
      CLAUDE_NATIVE_HOOK_EVENTS.filter((eventName) => {
        const hooks = projectSettingsHooks?.[eventName]
        return Array.isArray(hooks) && hooks.some(group => isManagedGroup(group as NativeHookMatcherGroup))
      })
    )
    const command = buildNodeScriptCommand({
      nodePath,
      scriptPath: MANAGED_COMMAND_PATH
    })

    const merged = mergeManagedHookGroups({
      existing,
      eventNames: CLAUDE_NATIVE_HOOK_EVENTS,
      enabled,
      isManagedGroup,
      createGroup: (eventName: string) => createManagedGroup(command, eventName as ClaudeNativeHookEvent),
      shouldManageEvent: (eventName: string) => !projectManagedEvents.has(eventName as ClaudeNativeHookEvent)
    })
    await writeJsonFile(settingsPath, merged)

    env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ = enabled ? '1' : '0'
    return enabled
  } catch (error) {
    logger.warn('[claude hooks] failed to install native hook bridge', error)
    env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ = '0'
    return false
  }
}
