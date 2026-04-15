import process from 'node:process'

import { Command } from 'commander'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerBenchmarkCommand } from '#~/commands/benchmark.js'

const { runBenchmarkCaseMock, runBenchmarkCategoryMock } = vi.hoisted(() => ({
  runBenchmarkCaseMock: vi.fn(),
  runBenchmarkCategoryMock: vi.fn()
}))

vi.mock('@vibe-forge/app-runtime', () => ({
  getBenchmarkCase: vi.fn(),
  listBenchmarkCases: vi.fn(),
  listBenchmarkCategories: vi.fn(),
  readBenchmarkResult: vi.fn(),
  runBenchmarkCase: runBenchmarkCaseMock,
  runBenchmarkCategory: runBenchmarkCategoryMock
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('benchmark command', () => {
  it('parses -A for benchmark run and forwards the normalized adapter id', async () => {
    runBenchmarkCaseMock.mockResolvedValue({
      result: {
        category: 'quality',
        title: 'cli-adapter',
        status: 'pass',
        finalScore: 100,
        scores: {
          testScore: 100,
          goalScore: 100,
          referenceScore: 100
        },
        durationMs: 1,
        timestamp: '2026-04-16T00:00:00.000Z',
        issues: []
      }
    })

    vi.spyOn(console, 'table').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(
      ((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`)
      }) as never
    )

    const program = new Command()
    registerBenchmarkCommand(program)

    await expect(program.parseAsync([
      'benchmark',
      'run',
      '--category',
      'quality',
      '--title',
      'cli-adapter',
      '-A',
      'claude'
    ], { from: 'user' })).rejects.toThrow('process.exit:0')

    expect(runBenchmarkCaseMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'quality',
      title: 'cli-adapter',
      adapter: 'claude-code'
    }))
    expect(runBenchmarkCategoryMock).not.toHaveBeenCalled()
  })
})
