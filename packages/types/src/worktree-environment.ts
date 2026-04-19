export type WorktreeEnvironmentOperation = 'create' | 'start' | 'destroy'
export type WorktreeEnvironmentPlatform = 'base' | 'macos' | 'linux' | 'windows'
export type WorktreeEnvironmentSource = 'project' | 'user'

export type WorktreeEnvironmentScriptKey =
  | 'create'
  | 'create.macos'
  | 'create.linux'
  | 'create.windows'
  | 'start'
  | 'start.macos'
  | 'start.linux'
  | 'start.windows'
  | 'destroy'
  | 'destroy.macos'
  | 'destroy.linux'
  | 'destroy.windows'

export interface WorktreeEnvironmentScript {
  key: WorktreeEnvironmentScriptKey
  operation: WorktreeEnvironmentOperation
  platform: WorktreeEnvironmentPlatform
  fileName: string
  exists: boolean
  content?: string
}

export interface WorktreeEnvironmentSummary {
  id: string
  path: string
  source: WorktreeEnvironmentSource
  isLocal: boolean
  scripts: WorktreeEnvironmentScript[]
}

export interface WorktreeEnvironmentDetail extends WorktreeEnvironmentSummary {
  scripts: WorktreeEnvironmentScript[]
}

export interface WorktreeEnvironmentListResult {
  environments: WorktreeEnvironmentSummary[]
}

export interface WorktreeEnvironmentMutationResult {
  environment: WorktreeEnvironmentDetail
}

export interface WorktreeEnvironmentSavePayload {
  scripts?: Partial<Record<WorktreeEnvironmentScriptKey, string>>
}
