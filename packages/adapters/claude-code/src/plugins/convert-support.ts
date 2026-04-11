import fs from 'node:fs/promises'
import path from 'node:path'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const SUPPORTED_CLAUDE_HOOK_EVENTS = new Set([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'SessionEnd'
])
const CLAUDE_TEMPLATE_PATTERN = /\$\{([^}]+)\}/g
export interface ClaudeTemplateContext {
  nativePluginRoot: string
  pluginDataDir: string
}
export const transformClaudeTemplateString = (
  value: string,
  context: ClaudeTemplateContext,
  sourceDescription: string,
  options?: {
    rewritePluginPaths?: boolean
  }
) => (
  value.replace(CLAUDE_TEMPLATE_PATTERN, (match, key: string) => {
    if (key === 'CLAUDE_PLUGIN_ROOT') {
      return options?.rewritePluginPaths === false ? match : context.nativePluginRoot
    }
    if (key === 'CLAUDE_PLUGIN_DATA') {
      return options?.rewritePluginPaths === false ? match : context.pluginDataDir
    }
    if (key.startsWith('user_config.')) {
      const optionKey = key.slice('user_config.'.length)
      throw new Error(
        `Claude plugin option "${optionKey}" is referenced by ${sourceDescription}, but userConfig mapping is not supported yet.`
      )
    }
    return match
  })
)
export const transformClaudeTemplateValue = (
  value: unknown,
  context: ClaudeTemplateContext,
  sourceDescription: string,
  options?: {
    rewritePluginPaths?: boolean
  }
): unknown => {
  if (typeof value === 'string') {
    return transformClaudeTemplateString(value, context, sourceDescription, options)
  }
  if (Array.isArray(value)) {
    return value.map(entry => transformClaudeTemplateValue(entry, context, sourceDescription, options))
  }
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      transformClaudeTemplateValue(entryValue, context, sourceDescription, options)
    ])
  )
}
const buildClaudePluginRuntimeEnv = (context: ClaudeTemplateContext) => ({
  CLAUDE_PLUGIN_ROOT: context.nativePluginRoot,
  CLAUDE_PLUGIN_DATA: context.pluginDataDir,
  CLAUDE_PLUGIN_DIR: context.nativePluginRoot
})
export const injectClaudePluginRuntimeEnv = (
  value: Record<string, unknown>,
  context: ClaudeTemplateContext
) => {
  const existingEnv = isRecord(value.env) ? value.env : {}
  return {
    ...value,
    env: {
      ...existingEnv,
      ...buildClaudePluginRuntimeEnv(context)
    }
  }
}
export const mergeHookGroups = (
  target: Record<string, unknown[]>,
  value: unknown,
  sourceDescription: string
) => {
  if (!isRecord(value)) return
  const record = isRecord(value.hooks) ? value.hooks : value
  for (const [eventName, groups] of Object.entries(record)) {
    if (!SUPPORTED_CLAUDE_HOOK_EVENTS.has(eventName)) {
      throw new TypeError(`Unsupported Claude hook event "${eventName}" found in ${sourceDescription}.`)
    }
    if (!Array.isArray(groups)) {
      throw new TypeError(`Invalid Claude hook group list for "${eventName}" in ${sourceDescription}.`)
    }

    groups.forEach((group, groupIndex) => {
      if (!isRecord(group)) {
        throw new TypeError(`Invalid Claude hook group "${eventName}[${groupIndex}]" in ${sourceDescription}.`)
      }
      const hooks = group.hooks
      if (hooks == null) return
      if (!Array.isArray(hooks)) {
        throw new TypeError(`Invalid Claude hook list for "${eventName}[${groupIndex}]" in ${sourceDescription}.`)
      }

      hooks.forEach((hook, hookIndex) => {
        if (!isRecord(hook)) {
          throw new TypeError(
            `Invalid Claude hook entry "${eventName}[${groupIndex}].hooks[${hookIndex}]" in ${sourceDescription}.`
          )
        }

        const type = hook.type == null ? 'command' : hook.type
        if (type !== 'command') {
          throw new Error(
            `Unsupported Claude hook type "${String(type)}" for "${eventName}" in ${sourceDescription}.`
          )
        }
        if (hook.command != null && typeof hook.command !== 'string') {
          throw new TypeError(
            `Invalid Claude hook command for "${eventName}[${groupIndex}].hooks[${hookIndex}]" in ${sourceDescription}.`
          )
        }
      })
    })

    target[eventName] = [...(target[eventName] ?? []), ...groups]
  }
}
const rewriteMarkdownFile = async (
  filePath: string,
  context: ClaudeTemplateContext,
  sourceDescription: string
) => {
  const content = await fs.readFile(filePath, 'utf8')
  await fs.writeFile(filePath, transformClaudeTemplateString(content, context, sourceDescription), 'utf8')
}
export const rewriteMarkdownTree = async (
  rootDir: string,
  context: ClaudeTemplateContext,
  sourceDescription: string
) => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      await rewriteMarkdownTree(entryPath, context, sourceDescription)
      return
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) return
    await rewriteMarkdownFile(entryPath, context, sourceDescription)
  }))
}
export const reserveTargetFile = (
  seenTargets: Map<string, string>,
  targetPath: string,
  sourceDescription: string,
  vibeForgeRoot: string
) => {
  const existing = seenTargets.get(targetPath)
  if (existing != null) {
    throw new Error(
      `Claude plugin assets conflict: ${existing} and ${sourceDescription} both map to ${
        path.relative(vibeForgeRoot, targetPath)
      }.`
    )
  }
  seenTargets.set(targetPath, sourceDescription)
}
export const writeGeneratedHooksModule = async (targetRoot: string, pluginName: string) => {
  await fs.writeFile(
    path.join(targetRoot, 'hooks.js'),
    [
      "const path = require('node:path')",
      "const { createClaudeJsonHooksPlugin } = require('@vibe-forge/hooks/claude-json-plugin')",
      '',
      'module.exports = createClaudeJsonHooksPlugin({',
      `  name: ${JSON.stringify(pluginName)},`,
      '  pluginDir: __dirname,',
      "  configPath: './hooks/claude-hooks.json',",
      "  claudePluginRoot: path.resolve(__dirname, '..', 'native'),",
      "  pluginDataDir: path.resolve(__dirname, '..', 'data')",
      '})',
      ''
    ].join('\n'),
    'utf8'
  )
}
