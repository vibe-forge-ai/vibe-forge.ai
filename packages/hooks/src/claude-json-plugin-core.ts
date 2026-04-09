import { resolve } from 'node:path'

import { definePlugin } from './context'
import type { Plugin } from './context'
import {
  getEventGroups,
  matchesToolHook,
  mergeHookOutputs,
  readClaudeHooksConfig,
  runClaudeCommandHook
} from './claude-json-plugin-support'
import type { HookInputs, HookOutputs } from './type'

const CLAUDE_JSON_PLUGIN_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'SessionEnd'
] as const satisfies Array<keyof HookInputs>

const createEventHandler = <K extends keyof HookInputs>(
  eventName: K,
  config: ReturnType<typeof readClaudeHooksConfig>,
  paths: {
    claudePluginRoot: string
    pluginDataDir: string
  }
) => async (
  ctx: Parameters<NonNullable<Plugin[K]>>[0],
  input: HookInputs[K],
  next: () => Promise<HookOutputs[K]>
) => {
  const groups = getEventGroups(config, eventName).filter(group => matchesToolHook(eventName, group, input))

  let localOutput = { continue: true } as HookOutputs[K]
  for (const group of groups) {
    for (const hook of group.hooks ?? []) {
      if (hook.type != null && hook.type !== 'command') {
        ctx.logger.warn(`[claude-json-plugin] unsupported hook type: ${hook.type}`)
        continue
      }
      if (typeof hook.command !== 'string' || hook.command.trim() === '') continue

      const result = await runClaudeCommandHook({
        command: hook.command,
        eventName,
        input,
        cwd: input.cwd,
        claudePluginRoot: paths.claudePluginRoot,
        pluginDataDir: paths.pluginDataDir
      })
      localOutput = mergeHookOutputs(localOutput, result)
      if (localOutput.continue === false) {
        return localOutput
      }
    }
  }

  const downstream = await next()
  return mergeHookOutputs(downstream, localOutput)
}

export const createClaudeJsonHooksPlugin = (params: {
  name: string
  pluginDir: string
  configPath: string
  claudePluginRoot: string
  pluginDataDir: string
}) => {
  const resolvedConfigPath = resolve(params.pluginDir, params.configPath)
  const config = readClaudeHooksConfig(resolvedConfigPath)
  const runtimePaths = {
    claudePluginRoot: params.claudePluginRoot,
    pluginDataDir: params.pluginDataDir
  }

  return definePlugin({
    name: params.name,
    SessionStart: createEventHandler('SessionStart', config, runtimePaths),
    UserPromptSubmit: createEventHandler('UserPromptSubmit', config, runtimePaths),
    PreToolUse: createEventHandler('PreToolUse', config, runtimePaths),
    PostToolUse: createEventHandler('PostToolUse', config, runtimePaths),
    Notification: createEventHandler('Notification', config, runtimePaths),
    Stop: createEventHandler('Stop', config, runtimePaths),
    SubagentStop: createEventHandler('SubagentStop', config, runtimePaths),
    PreCompact: createEventHandler('PreCompact', config, runtimePaths),
    SessionEnd: createEventHandler('SessionEnd', config, runtimePaths)
  } satisfies Partial<Plugin> & {
    [K in (typeof CLAUDE_JSON_PLUGIN_EVENTS)[number]]: Plugin[K]
  })
}
