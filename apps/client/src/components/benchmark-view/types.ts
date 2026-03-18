import type { BenchmarkCase } from '@vibe-forge/core'

export interface BenchmarkQueryParams extends Record<string, string> {
  category: string
  title: string
}

export interface TreeNodeCase extends BenchmarkCase {
  key: string
}
