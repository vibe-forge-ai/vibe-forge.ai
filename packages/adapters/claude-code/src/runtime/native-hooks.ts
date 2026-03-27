import { resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/core/adapter'
import {
  buildNodeScriptCommand,
  hasManagedHookPlugins,
  mergeManagedHookGroups,
  prepareManagedHookRuntime,
  readJsonFileOrDefault,
  resolveHookCliScriptPath,
  type NativeHookMatcherGroup,
  writeJsonFile
} from '@vibe-forge/core/hooks'

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

const MANAGED_COMMAND_PATH = resolveHookCliScriptPath('claude-hook.js')
const MANAGED_COMMAND_MARKERS = [
  MANAGED_COMMAND_PATH,
  'vf-call-hook',
  'claude-hook.js',
  'call-hook.js'
]

const isManagedGroup = (group: NativeHookMatcherGroup) => (
  Array.isArray(group.hooks) && group.hooks.some(hook => MANAGED_COMMAND_MARKERS.some(marker => hook.command.includes(marker)))
)

const createManagedGroup = (
  command: string,
  eventName: (typeof CLAUDE_NATIVE_HOOK_EVENTS)[number]
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
  const enabled = hasManagedHookPlugins({ assets })

  try {
    const { mockHome, nodePath } = prepareManagedHookRuntime(ctx)
    const settingsPath = resolve(mockHome, '.claude', 'settings.json')
    const projectSettingsPath = resolve(ctx.cwd, '.claude', 'settings.json')
    const existing = await readJsonFileOrDefault<unknown>(settingsPath, {})
    const projectSettings = await readJsonFileOrDefault<unknown>(projectSettingsPath, {})
    const projectManagedEvents = new Set(
      CLAUDE_NATIVE_HOOK_EVENTS.filter((eventName) => {
        const hooks = (
          projectSettings != null &&
          typeof projectSettings === 'object' &&
          !Array.isArray(projectSettings) &&
          projectSettings.hooks != null &&
          typeof projectSettings.hooks === 'object' &&
          !Array.isArray(projectSettings.hooks)
        )
          ? (projectSettings.hooks as Record<string, unknown>)[eventName]
          : undefined
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
      createGroup: (eventName) => createManagedGroup(command, eventName as (typeof CLAUDE_NATIVE_HOOK_EVENTS)[number]),
      shouldManageEvent: eventName => !projectManagedEvents.has(eventName)
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
