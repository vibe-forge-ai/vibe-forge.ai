import { createHash } from 'node:crypto'
import process from 'node:process'

import { createMdpClient } from '@modeldriveprotocol/client/node'
import type { Config, Definition, Skill, WorkspaceAsset } from '@vibe-forge/types'
import { expandSkillAssetDependenciesWithRegistry, resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'

import type { ResolvedMdpConfig } from './config'

interface ProjectedSkillEntry {
  path: string
  description?: string
  content: string
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface WorkspaceProjectionHandle {
  disconnect(): Promise<void>
}

const sanitizePathSegment = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
)

const toSkillPath = (asset: Extract<WorkspaceAsset, { kind: 'skill' }>) => {
  const parts = asset.displayName
    .split('/')
    .map(segment => sanitizePathSegment(segment))
    .filter(segment => segment !== '')

  return `/${parts.join('/')}/skill.md`
}

const buildAggregateSkillBody = (entries: ProjectedSkillEntry[]) => (
  [
    '# Workspace Skills',
    '',
    'Use this catalog when you want reusable workspace-owned skills rather than live browser/server/channel runtimes.',
    '',
    'These skills usually describe repeatable workflows, domain knowledge, or project-specific operating guidance.',
    '',
    'Recommended order:',
    '1. Read this catalog first.',
    '2. Pick one concrete child skill path from the list below.',
    '3. Do not guess child paths that are not listed here.',
    '',
    'Typical uses:',
    '- project-specific workflows',
    '- reusable operator guidance',
    '- domain knowledge that should be read before acting',
    '',
    ...entries.flatMap((entry) => [
      `- \`${entry.path}\`${entry.description ? `: ${entry.description}` : ''}`
    ])
  ].join('\n')
)

const shouldIncludeSkill = (
  asset: Extract<WorkspaceAsset, { kind: 'skill' }>,
  config: ResolvedMdpConfig['workspaceProjection']
) => {
  if (!config.includeWorkspaceSkills && asset.origin === 'workspace') {
    return false
  }
  if (!config.includePluginSkills && asset.origin === 'plugin') {
    return false
  }
  if (config.includeSkillIds.length > 0 && !config.includeSkillIds.includes(asset.id)) {
    return false
  }
  if (config.excludeSkillIds.includes(asset.id)) {
    return false
  }
  return true
}

const resolveSelectedSkillAssets = async (
  cwd: string,
  configs: [Config?, Config?] | undefined,
  projection: ResolvedMdpConfig['workspaceProjection']
) => {
  const bundle = await resolveWorkspaceAssetBundle({
    cwd,
    configs,
    useDefaultVibeForgeMcpServer: false
  })
  const selectedAssets = bundle.skills.filter(asset => shouldIncludeSkill(asset, projection))
  const skillAssets = [...bundle.skills]
  const allAssets = [...bundle.assets]
  const excludedIds = new Set(projection.excludeSkillIds)

  return expandSkillAssetDependenciesWithRegistry({
    allAssets,
    configs: bundle.configs ?? [undefined, undefined],
    cwd,
    excludedIds,
    selectedAssets,
    skillAssets
  })
}

const createProjectionEntries = async (
  cwd: string,
  configs: [Config?, Config?] | undefined,
  projection: ResolvedMdpConfig['workspaceProjection']
) => {
  const skills = await resolveSelectedSkillAssets(cwd, configs, projection)
  const entries = skills.map((asset) => ({
    path: toSkillPath(asset),
    description: asset.payload.definition.attributes.description,
    content: asset.payload.definition.body
  }))

  return [
    {
      path: '/skill.md',
      description: 'Workspace skill catalog',
      content: buildAggregateSkillBody(entries)
    },
    ...entries
  ] satisfies ProjectedSkillEntry[]
}

const createProjectionClientId = (cwd: string, connectionKey: string) => {
  const digest = createHash('sha1')
    .update(cwd)
    .update('\n')
    .update(connectionKey)
    .digest('hex')
    .slice(0, 10)
  return `vf-workspace-${digest}-${process.pid}`
}

const normalizeJsonValue = (value: unknown): JsonValue | undefined => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map(item => normalizeJsonValue(item))
      .filter((item): item is JsonValue => item !== undefined)
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, normalizeJsonValue(item)])
        .filter(([, item]) => item !== undefined)
    ) as JsonValue
  }

  return undefined
}

const normalizeAuth = (auth: ResolvedMdpConfig['connections'][number]['auth']) => {
  if (auth == null) return undefined

  const normalizedMetadata = normalizeJsonValue(auth.metadata)

  return {
    ...(auth.scheme ? { scheme: auth.scheme } : {}),
    ...(auth.token ? { token: auth.token } : {}),
    ...(auth.headers ? { headers: auth.headers } : {}),
    ...(normalizedMetadata != null && !Array.isArray(normalizedMetadata) && typeof normalizedMetadata === 'object'
      ? { metadata: normalizedMetadata }
      : {})
  }
}

export const startWorkspaceSkillProjection = async (params: {
  cwd: string
  configs?: [Config?, Config?]
  mdp: ResolvedMdpConfig
}): Promise<WorkspaceProjectionHandle[]> => {
  if (!params.mdp.enabled || !params.mdp.workspaceProjection.enabled) {
    return []
  }

  const entries = await createProjectionEntries(params.cwd, params.configs, params.mdp.workspaceProjection)
  if (entries.length === 0) {
    return []
  }

  const handles: WorkspaceProjectionHandle[] = []

  for (const connection of params.mdp.connections) {
    let projectionClient: ReturnType<typeof createMdpClient> | undefined
    let lastError: unknown

    for (const host of connection.hosts) {
      const client = createMdpClient({
        serverUrl: host,
        client: {
          id: createProjectionClientId(params.cwd, connection.key),
          name: 'Vibe Forge Workspace',
          description: 'Workspace skill projection for Vibe Forge',
          metadata: {
            connectionKey: connection.key,
            workspaceFolder: params.cwd
          }
        },
        ...(normalizeAuth(connection.auth) != null ? { auth: normalizeAuth(connection.auth) } : {}),
        reconnect: {
          enabled: true
        }
      })

      for (const entry of entries) {
        client.expose(entry.path, {
          description: entry.description
        }, () => entry.content)
      }

      try {
        await client.connect()
        client.register()
        projectionClient = client
        break
      } catch (error) {
        lastError = error
        await client.disconnect().catch(() => {})
      }
    }

    if (projectionClient == null) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError))
    }

    handles.push({
      async disconnect() {
        await projectionClient?.disconnect()
      }
    })
  }

  return handles
}
