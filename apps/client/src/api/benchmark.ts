import type { BenchmarkCase, BenchmarkCategory, BenchmarkResult, BenchmarkRunSummary } from '@vibe-forge/types'

import { createApiUrl, fetchApiJson, fetchApiJsonOrThrow, jsonHeaders } from './base'

export interface BenchmarkRunRequest {
  category: string
  title?: string
  concurrency?: number
  adapter?: string
  model?: string
  systemPrompt?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
}

export async function listBenchmarkCategories(): Promise<{ categories: BenchmarkCategory[] }> {
  return fetchApiJson<{ categories: BenchmarkCategory[] }>('/api/benchmark/categories')
}

export async function listBenchmarkCases(category?: string): Promise<{ cases: BenchmarkCase[] }> {
  const url = createApiUrl('/api/benchmark/cases')
  if (category) {
    url.searchParams.set('category', category)
  }
  return fetchApiJson<{ cases: BenchmarkCase[] }>(url)
}

export async function getBenchmarkCase(category: string, title: string): Promise<{ case: BenchmarkCase }> {
  return fetchApiJson<{ case: BenchmarkCase }>(
    `/api/benchmark/cases/${encodeURIComponent(category)}/${encodeURIComponent(title)}`
  )
}

export async function getBenchmarkResult(category: string, title: string): Promise<{ result: BenchmarkResult }> {
  return fetchApiJson<{ result: BenchmarkResult }>(
    `/api/benchmark/results/${encodeURIComponent(category)}/${encodeURIComponent(title)}`
  )
}

export async function startBenchmarkRun(payload: BenchmarkRunRequest): Promise<{ run: BenchmarkRunSummary }> {
  return fetchApiJsonOrThrow<{ run: BenchmarkRunSummary }>('/api/benchmark/run', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }, 'Failed to start benchmark run')
}

export async function getBenchmarkRun(runId: string): Promise<{ run: BenchmarkRunSummary }> {
  return fetchApiJson<{ run: BenchmarkRunSummary }>(`/api/benchmark/runs/${encodeURIComponent(runId)}`)
}
