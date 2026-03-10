import type { BenchmarkFrontmatter, BenchmarkResult } from './schema'

export interface BenchmarkCase {
  id: string
  category: string
  title: string
  caseDir: string
  rfcPath: string
  patchPath: string
  patchTestPath: string
  rfcBody: string
  rfcRaw: string
  summary: string
  frontmatter: BenchmarkFrontmatter
  latestResult?: BenchmarkResult | null
}

export interface BenchmarkCategory {
  category: string
  caseCount: number
  lastStatuses: Record<'pass' | 'partial' | 'fail', number>
}

export interface BenchmarkListOptions {
  workspaceFolder?: string
  category?: string
}

export interface BenchmarkCaseSelector {
  workspaceFolder?: string
  category: string
  title: string
}

export type BenchmarkPermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'

export interface BenchmarkAgentOptions {
  adapter?: string
  model?: string
  systemPrompt?: string
  permissionMode?: BenchmarkPermissionMode
  runtime?: 'cli' | 'server'
  env?: Record<string, string | null | undefined>
}

export interface BenchmarkRunEvent {
  runId: string
  category: string
  title?: string
  scope: 'category' | 'case'
  phase: 'discover' | 'workspace' | 'setup' | 'task' | 'verify' | 'result'
  message: string
  timestamp: string
}

export interface BenchmarkRunCaseInput extends BenchmarkCaseSelector, BenchmarkAgentOptions {
  runId?: string
  categoryRunId?: string
  onEvent?: (event: BenchmarkRunEvent) => void
}

export interface BenchmarkRunCaseOutput {
  runId: string
  result: BenchmarkResult
}

export interface BenchmarkRunCategoryInput extends BenchmarkAgentOptions {
  workspaceFolder?: string
  category: string
  titles?: string[]
  concurrency?: number
  runId?: string
  onEvent?: (event: BenchmarkRunEvent) => void
}

export interface BenchmarkRunCategoryOutput {
  runId: string
  category: string
  results: BenchmarkResult[]
}
