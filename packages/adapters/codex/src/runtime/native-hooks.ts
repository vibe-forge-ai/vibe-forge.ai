import { resolve } from 'node:path'

import type { AdapterCtx } from '@vibe-forge/types'
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

export const CODEX_NATIVE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop'
] as const

type CodexNativeHookEvent = (typeof CODEX_NATIVE_HOOK_EVENTS)[number]

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const MANAGED_COMMAND_PATH = resolveManagedHookScriptPath('call-hook.js')
const MANAGED_COMMAND_MARKERS = [
  MANAGED_COMMAND_PATH,
  'vf-call-hook',
  'codex-hook.js',
  'call-hook.js'
]

const isManagedGroup = (group: NativeHookMatcherGroup) => (
  Array.isArray(group.hooks) &&
  group.hooks.some(hook => MANAGED_COMMAND_MARKERS.some(marker => hook.command.includes(marker)))
)

const createManagedGroup = (
  command: string,
  eventName: CodexNativeHookEvent
): NativeHookMatcherGroup => ({
  ...(eventName === 'PreToolUse' || eventName === 'PostToolUse'
    ? { matcher: '^Bash$' }
    : {}),
  hooks: [{
    type: 'command',
    command,
    timeout: 600,
    statusMessage: `running vibe-forge ${eventName} hook`
  }]
})

export const ensureCodexNativeHooksInstalled = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'logger' | 'assets'>
) => {
  const { env, logger, assets } = ctx

  env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ = '0'
  const enabled = hasManagedHookPlugins({ assets })

  try {
    const { mockHome, nodePath } = prepareManagedHookRuntime(ctx)
    const hooksPath = resolve(mockHome, '.codex', 'hooks.json')
    const projectHooksPath = resolve(ctx.cwd, '.codex', 'hooks.json')
    const existing = await readJsonFileOrDefault<unknown>(hooksPath, {})
    const projectHooks = await readJsonFileOrDefault<unknown>(projectHooksPath, {})
    const projectHooksConfig = isRecord(projectHooks) && isRecord(projectHooks.hooks)
      ? projectHooks.hooks
      : undefined
    const projectManagedEvents = new Set<CodexNativeHookEvent>(
      CODEX_NATIVE_HOOK_EVENTS.filter((eventName) => {
        const hooks = projectHooksConfig?.[eventName]
        return Array.isArray(hooks) && hooks.some(group => isManagedGroup(group as NativeHookMatcherGroup))
      })
    )
    const command = buildNodeScriptCommand({
      nodePath,
      scriptPath: MANAGED_COMMAND_PATH
    })

    const merged = mergeManagedHookGroups({
      existing,
      eventNames: CODEX_NATIVE_HOOK_EVENTS,
      enabled,
      isManagedGroup,
      createGroup: (eventName: string) => createManagedGroup(command, eventName as CodexNativeHookEvent),
      shouldManageEvent: (eventName: string) => !projectManagedEvents.has(eventName as CodexNativeHookEvent)
    })
    await writeJsonFile(hooksPath, merged)

    env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ = enabled ? '1' : '0'
    return enabled
  } catch (error) {
    logger.warn('[codex hooks] failed to install native hook bridge', error)
    env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ = '0'
    return false
  }
}
