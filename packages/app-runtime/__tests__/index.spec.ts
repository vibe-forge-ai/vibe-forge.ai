import { generateAdapterQueryOptions, listBenchmarkCases, run } from '#~/index.js'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateAdapterQueryOptions: vi.fn(),
  listBenchmarkCases: vi.fn(),
  run: vi.fn()
}))

vi.mock('@vibe-forge/task', () => ({
  generateAdapterQueryOptions: mocks.generateAdapterQueryOptions,
  run: mocks.run
}))

vi.mock('@vibe-forge/benchmark', () => ({
  listBenchmarkCases: mocks.listBenchmarkCases
}))

describe('app-runtime facade', () => {
  it('re-exports task and benchmark runtime APIs', () => {
    expect(generateAdapterQueryOptions).toBe(mocks.generateAdapterQueryOptions)
    expect(run).toBe(mocks.run)
    expect(listBenchmarkCases).toBe(mocks.listBenchmarkCases)
  })
})
