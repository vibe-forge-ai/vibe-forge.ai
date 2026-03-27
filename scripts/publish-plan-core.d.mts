export type PublishPlanBumpKind = 'major' | 'minor' | 'patch'

export interface PublishPlanOptions {
  packages: string[]
  publish: boolean
  access: string
  tag: string
  dryRun: boolean
  noGitChecks: boolean
  bump: '' | PublishPlanBumpKind
  confirmRetry: boolean
  json: boolean
  includePrivate: boolean
  help: boolean
}

export interface PublishPlanPackageJson {
  name?: string
  version?: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

export interface PublishPlanPackage {
  name: string
  dir: string
  private: boolean
  json: PublishPlanPackageJson
}

export interface PublishPlanImpact {
  name: string
  range: string
  field: 'dependencies' | 'peerDependencies' | 'optionalDependencies'
  requiresRangeUpdate: boolean
}

export interface PublishPlanItem {
  name: string
  dir: string
  version: string
  nextVersion: string
  private: boolean
  internalDependencies: string[]
  impactedDependents: PublishPlanImpact[]
}

export interface PublishPlan {
  explicitSelection: boolean
  requestedNames: string[]
  skippedPrivate: string[]
  items: PublishPlanItem[]
}

export interface PublishPlanSerializeResult {
  summary: {
    mode: 'plan' | 'publish' | 'publish-dry-run'
    packageCount: number
    skippedPrivate: string[]
    bump: PublishPlanOptions['bump'] | null
    command: string[] | null
  }
  order: Array<{
    index: number
    name: string
    version: string | null
    nextVersion: string | null
    dir: string
    internalDependencies: string[]
    impactedDependents: PublishPlanImpact[]
  }>
}

export declare const dependencyFields: readonly string[]
export declare const bumpKinds: Set<PublishPlanBumpKind>
export declare const defaultOptions: PublishPlanOptions
export declare const helpText: string

export declare function parseArgs(argv: string[]): PublishPlanOptions
export declare function bumpVersion(rawVersion: string, kind: PublishPlanBumpKind): string
export declare function buildPublishArgs(options: Pick<PublishPlanOptions, 'access' | 'tag' | 'dryRun' | 'noGitChecks'>): string[]
export declare function parseWorkspacePatterns(workspaceConfig: string): string[]
export declare function expandWorkspaceDirs(
  repoRoot: string,
  workspacePatterns: string[],
  fsOps?: {
    readText(filePath: string): Promise<string>
    readdir(dirPath: string): Promise<string[]>
    stat(filePath: string): Promise<{ isDirectory(): boolean }>
    writeText(filePath: string, content: string): Promise<void>
  }
): Promise<string[]>
export declare function loadWorkspacePackages(
  repoRoot: string,
  fsOps?: {
    readText(filePath: string): Promise<string>
    readdir(dirPath: string): Promise<string[]>
    stat(filePath: string): Promise<{ isDirectory(): boolean }>
    writeText(filePath: string, content: string): Promise<void>
  }
): Promise<Map<string, PublishPlanPackage>>
export declare function createPublishPlan(
  packages: Map<string, PublishPlanPackage>,
  options: PublishPlanOptions
): PublishPlan
export declare function formatPlan(plan: PublishPlan, repoRoot: string, options: PublishPlanOptions): string
export declare function serializePlan(plan: PublishPlan, repoRoot: string, options: PublishPlanOptions): PublishPlanSerializeResult
export declare function applyVersionBump(
  plan: PublishPlan,
  packages: Map<string, PublishPlanPackage>,
  kind: PublishPlanBumpKind,
  fsOps?: {
    readText(filePath: string): Promise<string>
    readdir(dirPath: string): Promise<string[]>
    stat(filePath: string): Promise<{ isDirectory(): boolean }>
    writeText(filePath: string, content: string): Promise<void>
  }
): Promise<Array<{ name: string; version: string }>>
export declare function promptRetry(
  pkgName: string,
  options: Pick<PublishPlanOptions, 'confirmRetry'>,
  io?: {
    stdin?: { isTTY?: boolean }
    stdout?: { write(value: string): void }
  }
): Promise<boolean>
export declare function executePublishPlan(
  plan: PublishPlan,
  options: PublishPlanOptions,
  runCommand?: typeof import('node:child_process').spawnSync,
  retryPrompt?: typeof promptRetry
): Promise<{
  failures: Array<{ name: string; status: number }>
  attempts: Array<{ name: string; status: number; attempts: number; success: boolean }>
}>
export declare function runPublishPlanCli(
  argv?: string[],
  runtime?: {
    repoRoot?: string
    stdout?: { write(value: string): void }
    fsOps?: {
      readText(filePath: string): Promise<string>
      readdir(dirPath: string): Promise<string[]>
      stat(filePath: string): Promise<{ isDirectory(): boolean }>
      writeText(filePath: string, content: string): Promise<void>
    }
    runCommand?: typeof import('node:child_process').spawnSync
    retryPrompt?: typeof promptRetry
  }
): Promise<unknown>
