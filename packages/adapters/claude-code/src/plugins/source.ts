import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

export interface ClaudePluginManifest {
  name?: string
  description?: string
  version?: string
  strict?: boolean
  skills?: string | string[]
  commands?: string | string[]
  agents?: string | string[]
  hooks?: string | string[] | Record<string, unknown>
  mcpServers?: string | string[] | Record<string, unknown>
  userConfig?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

export const pathExists = async (target: string) => {
  try {
    await fs.access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export const parseClaudePluginManifest = async (pluginRoot: string): Promise<ClaudePluginManifest | undefined> => {
  const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json')
  if (!await pathExists(manifestPath)) return undefined

  const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown
  return isRecord(raw) ? raw as ClaudePluginManifest : undefined
}

export const mergeClaudePluginManifest = (
  manifest: ClaudePluginManifest | undefined,
  overrides: Partial<ClaudePluginManifest> | undefined
): ClaudePluginManifest | undefined => {
  if (manifest == null && overrides == null) return undefined
  return {
    ...(manifest ?? {}),
    ...(overrides ?? {})
  }
}

export const detectClaudePluginRoot = async (baseDir: string): Promise<string> => {
  const candidates = [baseDir, path.join(baseDir, 'package')]

  for (const candidate of candidates) {
    if (
      await pathExists(path.join(candidate, '.claude-plugin', 'plugin.json')) ||
      await pathExists(path.join(candidate, 'skills')) ||
      await pathExists(path.join(candidate, 'commands')) ||
      await pathExists(path.join(candidate, 'agents')) ||
      await pathExists(path.join(candidate, 'hooks')) ||
      await pathExists(path.join(candidate, '.mcp.json'))
    ) {
      return candidate
    }
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  const onlyDir = entries.find(entry => entry.isDirectory())
  if (entries.length === 1 && onlyDir != null) {
    return detectClaudePluginRoot(path.join(baseDir, onlyDir.name))
  }

  throw new Error('The installed source does not look like a Claude Code plugin.')
}
