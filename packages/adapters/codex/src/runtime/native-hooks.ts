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

export const CODEX_NATIVE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop'
] as const

const MANAGED_COMMAND_PATH = resolveHookCliScriptPath('codex-hook.js')

const isManagedGroup = (group: NativeHookMatcherGroup) => (
  Array.isArray(group.hooks) && group.hooks.some(hook => hook.command.includes(MANAGED_COMMAND_PATH))
)

const createManagedGroup = (
  command: string,
  eventName: (typeof CODEX_NATIVE_HOOK_EVENTS)[number]
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
    const existing = await readJsonFileOrDefault<unknown>(hooksPath, {})
    const command = buildNodeScriptCommand({
      nodePath,
      scriptPath: MANAGED_COMMAND_PATH
    })

    const merged = mergeManagedHookGroups({
      existing,
      eventNames: CODEX_NATIVE_HOOK_EVENTS,
      enabled,
      isManagedGroup,
      createGroup: (eventName) => createManagedGroup(command, eventName as (typeof CODEX_NATIVE_HOOK_EVENTS)[number])
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
