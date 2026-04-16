import {
  buildNodeScriptCommand,
  hasManagedHookPlugins,
  mergeManagedHookGroups,
  prepareManagedHookRuntime,
  resolveManagedHookScriptPath
} from '@vibe-forge/hooks'
import type { NativeHookMatcherGroup } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

export interface GeminiNativeHooksSettings {
  hooks?: Record<string, NativeHookMatcherGroup[]>
  hooksConfig?: {
    enabled?: boolean
    disabled?: string[]
  }
}

export const GEMINI_NATIVE_HOOK_EVENTS = [
  'SessionStart',
  'BeforeAgent',
  'BeforeTool',
  'AfterTool',
  'AfterAgent',
  'PreCompress'
] as const

type GeminiNativeHookEvent = (typeof GEMINI_NATIVE_HOOK_EVENTS)[number]

const MANAGED_COMMAND_PATH = resolveManagedHookScriptPath('call-hook.js')
const MANAGED_COMMAND_MARKERS = [
  MANAGED_COMMAND_PATH,
  'vf-call-hook',
  'call-hook.js'
]

const isManagedGroup = (group: NativeHookMatcherGroup) => (
  Array.isArray(group.hooks) &&
  group.hooks.some(hook => MANAGED_COMMAND_MARKERS.some(marker => hook.command.includes(marker)))
)

const createManagedGroup = (
  command: string,
  eventName: GeminiNativeHookEvent
): NativeHookMatcherGroup => ({
  ...(eventName === 'BeforeTool' || eventName === 'AfterTool'
    ? { matcher: '.*' }
    : {}),
  hooks: [{
    type: 'command',
    command,
    timeout: 600
  }]
})

export const buildGeminiNativeHooksSettings = (
  env: Record<string, string | null | undefined>
): GeminiNativeHooksSettings => {
  const command = env.__VF_PROJECT_AI_GEMINI_HOOK_COMMAND__?.trim()
  if (env.__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__ !== '1' || command == null || command === '') {
    return {}
  }

  const merged = mergeManagedHookGroups({
    existing: {},
    eventNames: GEMINI_NATIVE_HOOK_EVENTS,
    enabled: true,
    isManagedGroup,
    createGroup: (eventName) => createManagedGroup(command, eventName as GeminiNativeHookEvent)
  })

  return {
    hooksConfig: {
      enabled: true
    },
    ...(merged.hooks == null ? {} : { hooks: merged.hooks as Record<string, NativeHookMatcherGroup[]> })
  }
}

export const prepareGeminiNativeHooks = (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'logger' | 'assets'>
) => {
  const { env, logger, assets } = ctx
  env.__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__ = '0'
  const enabled = hasManagedHookPlugins({ assets }) || env.__VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__ === '1'

  try {
    const { nodePath } = prepareManagedHookRuntime(ctx)
    env.__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__ = enabled ? '1' : '0'
    env.__VF_PROJECT_AI_GEMINI_HOOK_COMMAND__ = buildNodeScriptCommand({
      nodePath,
      scriptPath: MANAGED_COMMAND_PATH
    })
    return enabled
  } catch (error) {
    logger.warn('[gemini hooks] failed to prepare native hook bridge', error)
    env.__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__ = '0'
    delete env.__VF_PROJECT_AI_GEMINI_HOOK_COMMAND__
    return false
  }
}
