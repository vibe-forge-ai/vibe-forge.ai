import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

import type { Config, WorkspaceAsset, WorkspaceAssetAdapter } from '@vibe-forge/types'
import { resolveRelativePath } from '@vibe-forge/utils'
import { glob } from 'fast-glob'
import yaml from 'js-yaml'

import { isPluginEnabled, resolvePluginIdFromPath } from './helpers'
import type { WorkspaceOpenCodeOverlayAsset } from './internal-types'

const parseStructuredDocument = async (path: string) => {
  const raw = await readFile(path, 'utf8')
  const extension = extname(path).toLowerCase()
  if (extension === '.yaml' || extension === '.yml') {
    return yaml.load(raw)
  }
  return JSON.parse(raw)
}

export const loadPluginMcpAssets = async (
  cwd: string,
  enabledPlugins: Record<string, boolean>
): Promise<Array<Extract<WorkspaceAsset, { kind: 'mcpServer' }>>> => {
  const paths = await glob([
    '.ai/plugins/*/mcp/*.json',
    '.ai/plugins/*/mcp/*.yaml',
    '.ai/plugins/*/mcp/*.yml'
  ], {
    cwd,
    absolute: true
  })

  const entries = await Promise.all(paths.map(async (path) => {
    const pluginId = resolvePluginIdFromPath(cwd, path)
    if (!isPluginEnabled(enabledPlugins, pluginId)) return undefined

    const parsed = await parseStructuredDocument(path)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined

    const record = parsed as Record<string, unknown>
    const name = typeof record.name === 'string' && record.name.trim() !== ''
      ? record.name.trim()
      : basename(path, extname(path))
    const { name: _name, ...config } = record

    return {
      id: `mcpServer:${resolveRelativePath(cwd, path)}`,
      kind: 'mcpServer',
      pluginId,
      origin: 'plugin',
      scope: 'workspace',
      enabled: true,
      targets: ['claude-code', 'codex', 'opencode'],
      payload: {
        name,
        config: config as NonNullable<Config['mcpServers']>[string]
      }
    } satisfies Extract<WorkspaceAsset, { kind: 'mcpServer' }>
  }))

  return entries.filter((entry): entry is NonNullable<typeof entry> => entry != null)
}

export const loadOpenCodeOverlayAssets = async (
  cwd: string,
  enabledPlugins: Record<string, boolean>
): Promise<WorkspaceOpenCodeOverlayAsset[]> => {
  const paths = await glob([
    '.ai/plugins/*/opencode/plugins/*',
    '.ai/plugins/*/opencode/agents/*',
    '.ai/plugins/*/opencode/commands/*',
    '.ai/plugins/*/opencode/modes/*'
  ], {
    cwd,
    absolute: true,
    onlyFiles: false
  })

  return paths
    .map((path) => {
      const relativePath = resolveRelativePath(cwd, path)
      const match = relativePath.match(/^\.ai\/plugins\/([^/]+)\/opencode\/(plugins|agents|commands|modes)\/([^/]+)$/)
      if (!match) return undefined

      const [, pluginId, rawFolder, entryName] = match
      if (!isPluginEnabled(enabledPlugins, pluginId)) return undefined

      const base = {
        pluginId,
        origin: 'plugin' as const,
        scope: 'workspace' as const,
        enabled: true,
        targets: ['opencode'] as WorkspaceAssetAdapter[],
        payload: {
          sourcePath: path,
          entryName,
          targetSubpath: `${rawFolder}/${entryName}`
        }
      }

      if (rawFolder === 'plugins') {
        return {
          id: `nativePlugin:${relativePath}`,
          kind: 'nativePlugin',
          ...base
        } satisfies Extract<WorkspaceAsset, { kind: 'nativePlugin' }>
      }

      if (rawFolder === 'agents') {
        return {
          id: `agent:${relativePath}`,
          kind: 'agent',
          ...base
        } satisfies Extract<WorkspaceAsset, { kind: 'agent' }>
      }

      if (rawFolder === 'commands') {
        return {
          id: `command:${relativePath}`,
          kind: 'command',
          ...base
        } satisfies Extract<WorkspaceAsset, { kind: 'command' }>
      }

      return {
        id: `mode:${relativePath}`,
        kind: 'mode',
        ...base
      } satisfies Extract<WorkspaceAsset, { kind: 'mode' }>
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
}

export const createHookPluginAssets = (
  config: Config['plugins'],
  enabledPlugins: Record<string, boolean>,
  scope: Extract<WorkspaceAsset['scope'], 'project' | 'user'>
): Array<Extract<WorkspaceAsset, { kind: 'hookPlugin' }>> => {
  if (config == null || Array.isArray(config)) return [] as Array<Extract<WorkspaceAsset, { kind: 'hookPlugin' }>>

  return Object.entries(config)
    .filter((entry) => enabledPlugins[entry[0]] !== false)
    .map(([pluginId, pluginConfig]) => ({
      id: `hookPlugin:${scope}:${pluginId}`,
      kind: 'hookPlugin',
      pluginId,
      origin: 'config',
      scope,
      enabled: true,
      targets: ['claude-code', 'codex', 'opencode'],
      payload: {
        packageName: pluginId,
        config: pluginConfig
      }
    } satisfies Extract<WorkspaceAsset, { kind: 'hookPlugin' }>))
}

export const createClaudeNativePluginAssets = (
  enabledPlugins: Record<string, boolean>
): Array<Extract<WorkspaceAsset, { kind: 'nativePlugin' }>> => {
  return Object.entries(enabledPlugins).map(([pluginId, enabled]) => ({
    id: `nativePlugin:claude-code:${pluginId}`,
    kind: 'nativePlugin',
    pluginId,
    origin: 'config',
    scope: 'project',
    enabled,
    targets: ['claude-code'],
    payload: {
      name: pluginId,
      enabled
    }
  } satisfies Extract<WorkspaceAsset, { kind: 'nativePlugin' }>))
}
