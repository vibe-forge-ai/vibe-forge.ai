import type {
  WorktreeEnvironmentDetail,
  WorktreeEnvironmentOperation,
  WorktreeEnvironmentPlatform,
  WorktreeEnvironmentScriptKey,
  WorktreeEnvironmentSummary
} from '@vibe-forge/types'

export const scriptKeys: WorktreeEnvironmentScriptKey[] = [
  'create',
  'create.macos',
  'create.linux',
  'create.windows',
  'start',
  'start.macos',
  'start.linux',
  'start.windows',
  'destroy',
  'destroy.macos',
  'destroy.linux',
  'destroy.windows'
]

export const operationGroups: Array<{
  operation: WorktreeEnvironmentOperation
  baseScript: WorktreeEnvironmentScriptKey
  platformScripts: Array<{
    platform: Exclude<WorktreeEnvironmentPlatform, 'base'>
    script: WorktreeEnvironmentScriptKey
  }>
}> = [
  {
    operation: 'create',
    baseScript: 'create',
    platformScripts: [
      { platform: 'macos', script: 'create.macos' },
      { platform: 'linux', script: 'create.linux' },
      { platform: 'windows', script: 'create.windows' }
    ]
  },
  {
    operation: 'start',
    baseScript: 'start',
    platformScripts: [
      { platform: 'macos', script: 'start.macos' },
      { platform: 'linux', script: 'start.linux' },
      { platform: 'windows', script: 'start.windows' }
    ]
  },
  {
    operation: 'destroy',
    baseScript: 'destroy',
    platformScripts: [
      { platform: 'macos', script: 'destroy.macos' },
      { platform: 'linux', script: 'destroy.linux' },
      { platform: 'windows', script: 'destroy.windows' }
    ]
  }
]

export const buildDraftScripts = (environment?: WorktreeEnvironmentDetail) => {
  const scripts = Object.fromEntries(scriptKeys.map(key => [key, ''])) as Record<WorktreeEnvironmentScriptKey, string>
  for (const script of environment?.scripts ?? []) {
    scripts[script.key] = script.content ?? ''
  }
  return scripts
}

export const buildDefaultEnvironmentScripts = (): Partial<Record<WorktreeEnvironmentScriptKey, string>> => ({
  create: [
    '# Runs after the worktree is created.',
    '# Example:',
    '# pnpm install'
  ].join('\n'),
  start: [
    '# Runs before the adapter process starts.',
    '# Example:',
    '# docker compose up -d'
  ].join('\n'),
  destroy: [
    '# Runs before the managed worktree is removed.',
    '# Example:',
    '# docker compose down --remove-orphans'
  ].join('\n')
})

export const normalizeEnvironmentId = (value: string) => value.trim()

export const toDisplayEnvironmentName = (id: string) => (
  id.endsWith('.local') ? id.slice(0, -'.local'.length) : id
)

export const toEnvironmentReference = (
  environment: Pick<WorktreeEnvironmentSummary, 'id' | 'isLocal'>
) => (
  environment.isLocal ? `${toDisplayEnvironmentName(environment.id)}.local` : environment.id
)

export const toEnvironmentIdForSource = (value: string, source: 'project' | 'user') => {
  const normalized = normalizeEnvironmentId(value)
  if (normalized === '') return ''
  const shouldStripLocalSuffix = source === 'project' || source === 'user'
  return shouldStripLocalSuffix && normalized.endsWith('.local') ? normalized.slice(0, -'.local'.length) : normalized
}

export const getScriptLanguage = (key: WorktreeEnvironmentScriptKey) => (
  key.endsWith('.windows') ? 'powershell' : 'shell'
)
