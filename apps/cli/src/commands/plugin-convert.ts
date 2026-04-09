import fs from 'node:fs/promises'
import path from 'node:path'

import {
  injectClaudePluginRuntimeEnv,
  mergeHookGroups,
  reserveTargetFile,
  rewriteMarkdownTree,
  transformClaudeTemplateString,
  transformClaudeTemplateValue,
  writeGeneratedHooksModule
} from './plugin-convert-support'
import type { ClaudeTemplateContext } from './plugin-convert-support'
import type { ClaudePluginManifest } from './plugin-source'
import { parseClaudePluginManifest, pathExists } from './plugin-source'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const asStringList = (value: unknown): string[] => (
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : []
)

export const toPluginSlug = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plugin'
)

const collectSkillSourceDirs = async (pluginRoot: string, manifest: ClaudePluginManifest | undefined) => {
  const entries = manifest?.skills != null ? asStringList(manifest.skills) : ['skills']
  const dirs = new Map<string, string>()

  for (const entry of entries) {
    const resolved = path.resolve(pluginRoot, entry)
    if (!await pathExists(resolved)) continue

    const stat = await fs.stat(resolved)
    if (stat.isFile() && path.basename(resolved) === 'SKILL.md') {
      dirs.set(path.basename(path.dirname(resolved)), path.dirname(resolved))
      continue
    }
    if (!stat.isDirectory()) continue
    if (await pathExists(path.join(resolved, 'SKILL.md'))) {
      dirs.set(path.basename(resolved), resolved)
      continue
    }

    const childEntries = await fs.readdir(resolved, { withFileTypes: true })
    for (const child of childEntries.filter(item => item.isDirectory())) {
      const skillFile = path.join(resolved, child.name, 'SKILL.md')
      if (await pathExists(skillFile)) {
        dirs.set(child.name, path.join(resolved, child.name))
      }
    }
  }

  return dirs
}

const collectMarkdownFiles = async (pluginRoot: string, entriesValue: string | string[] | undefined, fallbackDir: string) => {
  const entries = entriesValue != null ? asStringList(entriesValue) : [fallbackDir]
  const files = new Map<string, string>()

  for (const entry of entries) {
    const resolved = path.resolve(pluginRoot, entry)
    if (!await pathExists(resolved)) continue
    const stat = await fs.stat(resolved)
    if (stat.isFile() && path.extname(resolved) === '.md') {
      files.set(path.basename(resolved, '.md'), resolved)
      continue
    }
    if (!stat.isDirectory()) continue

    const childEntries = await fs.readdir(resolved, { withFileTypes: true })
    for (const child of childEntries.filter(item => item.isFile() && item.name.endsWith('.md'))) {
      files.set(path.basename(child.name, '.md'), path.join(resolved, child.name))
    }
  }

  return files
}

const mergeMcpConfig = (target: Record<string, Record<string, unknown>>, value: unknown) => {
  if (!isRecord(value)) return
  const record = isRecord(value.mcpServers) ? value.mcpServers : value
  for (const [name, config] of Object.entries(record)) {
    if (isRecord(config)) target[name] = config
  }
}

const readStructuredConfigValues = async (pluginRoot: string, value: unknown): Promise<unknown[]> => {
  if (typeof value === 'string') {
    const resolved = path.resolve(pluginRoot, value)
    if (!await pathExists(resolved)) return []

    const stat = await fs.stat(resolved)
    if (stat.isDirectory()) {
      const entries = await fs.readdir(resolved, { withFileTypes: true })
      return Promise.all(
        entries
          .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
          .map(entry => fs.readFile(path.join(resolved, entry.name), 'utf8').then(JSON.parse))
      )
    }
    return [JSON.parse(await fs.readFile(resolved, 'utf8'))]
  }

  if (Array.isArray(value)) {
    const nested = await Promise.all(value.map(entry => readStructuredConfigValues(pluginRoot, entry)))
    return nested.flat()
  }

  return isRecord(value) ? [value] : []
}
export const convertClaudePluginToVibeForge = async (params: {
  nativePluginRoot: string
  vibeForgeRoot: string
  pluginName: string
  pluginDataDir: string
}) => {
  const manifest = await parseClaudePluginManifest(params.nativePluginRoot)
  const context: ClaudeTemplateContext = {
    nativePluginRoot: params.nativePluginRoot,
    pluginDataDir: params.pluginDataDir
  }
  const seenTargets = new Map<string, string>()

  for (const [name, sourceDir] of await collectSkillSourceDirs(params.nativePluginRoot, manifest)) {
    const targetDir = path.join(params.vibeForgeRoot, 'skills', name)
    const targetSkillPath = path.join(targetDir, 'SKILL.md')
    reserveTargetFile(seenTargets, targetSkillPath, `skill "${name}"`, params.vibeForgeRoot)
    await fs.cp(sourceDir, targetDir, { recursive: true })
    await rewriteMarkdownTree(targetDir, context, `skill "${name}"`)
  }
  for (const [name, sourcePath] of await collectMarkdownFiles(params.nativePluginRoot, manifest?.commands, 'commands')) {
    const targetPath = path.join(params.vibeForgeRoot, 'skills', name, 'SKILL.md')
    reserveTargetFile(seenTargets, targetPath, `command "${name}"`, params.vibeForgeRoot)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(
      targetPath,
      transformClaudeTemplateString(await fs.readFile(sourcePath, 'utf8'), context, `command "${name}"`),
      'utf8'
    )
  }
  for (const [name, sourcePath] of await collectMarkdownFiles(params.nativePluginRoot, manifest?.agents, 'agents')) {
    const targetPath = path.join(params.vibeForgeRoot, 'entities', name, 'README.md')
    reserveTargetFile(seenTargets, targetPath, `agent "${name}"`, params.vibeForgeRoot)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(
      targetPath,
      transformClaudeTemplateString(await fs.readFile(sourcePath, 'utf8'), context, `agent "${name}"`),
      'utf8'
    )
  }

  const mergedMcp: Record<string, Record<string, unknown>> = {}
  for (const value of (manifest?.mcpServers != null
    ? await readStructuredConfigValues(params.nativePluginRoot, manifest.mcpServers)
    : await readStructuredConfigValues(params.nativePluginRoot, '.mcp.json'))) {
    const transformed = transformClaudeTemplateValue(value, context, 'Claude plugin MCP config')
    mergeMcpConfig(mergedMcp, transformed)
  }
  for (const [name, config] of Object.entries(mergedMcp)) {
    const targetPath = path.join(params.vibeForgeRoot, 'mcp', `${name}.json`)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(
      targetPath,
      `${JSON.stringify(injectClaudePluginRuntimeEnv(config, context), null, 2)}\n`,
      'utf8'
    )
  }

  const hooks: Record<string, unknown[]> = {}
  for (const value of (manifest?.hooks != null
    ? await readStructuredConfigValues(params.nativePluginRoot, manifest.hooks)
    : await readStructuredConfigValues(params.nativePluginRoot, path.join('hooks', 'hooks.json')))) {
    const transformed = transformClaudeTemplateValue(
      value,
      context,
      'Claude plugin hooks config',
      { rewritePluginPaths: false }
    )
    mergeHookGroups(hooks, transformed, 'Claude plugin hooks config')
  }
  if (Object.keys(hooks).length > 0) {
    const hooksConfigPath = path.join(params.vibeForgeRoot, 'hooks', 'claude-hooks.json')
    await fs.mkdir(path.dirname(hooksConfigPath), { recursive: true })
    await fs.writeFile(hooksConfigPath, `${JSON.stringify({ hooks }, null, 2)}\n`, 'utf8')
    await writeGeneratedHooksModule(params.vibeForgeRoot, params.pluginName)
  }
}
