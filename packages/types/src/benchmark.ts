import type { SessionPermissionMode } from './session'

export interface BenchmarkFrontmatter {
  title?: string
  description?: string
  baseCommit: string
  setupCommand: string
  testCommand: string
  timeoutSec: number
}

export type BenchmarkStatus = 'pass' | 'partial' | 'fail'

export interface BenchmarkScores {
  testScore: number
  goalScore: number
  referenceScore: number
}

export interface BenchmarkResult {
  category: string
  title: string
  status: BenchmarkStatus
  finalScore: number
  scores: BenchmarkScores
  baseCommit: string
  durationMs: number
  setupCommand: string
  testCommand: string
  testExitCode: number
  judgeSummary: string
  issues: string[]
  timestamp: string
  runId?: string
  taskSessionId?: string
  taskExitCode?: number
  changedFiles?: string[]
  categoryRunId?: string
}

export interface BenchmarkRunSummary {
  runId: string
  category: string
  title?: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  startedAt: number
  finishedAt?: number
  completedCount?: number
  totalCount?: number
  result?: BenchmarkResult
  results?: BenchmarkResult[]
  error?: string
  lastMessage?: string
}

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
  lastStatuses: Record<BenchmarkStatus, number>
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

export type BenchmarkPermissionMode = SessionPermissionMode

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
