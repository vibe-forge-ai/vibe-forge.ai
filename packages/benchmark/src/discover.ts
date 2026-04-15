import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import process from 'node:process'

import { glob } from 'fast-glob'
import fm from 'front-matter'
import { resolveProjectAiPath } from '@vibe-forge/utils'

import { readBenchmarkResult } from './result-store'
import { BenchmarkFrontmatterSchema } from './schema'
import type { BenchmarkCase, BenchmarkCaseSelector, BenchmarkCategory, BenchmarkListOptions } from './types'

export const resolveBenchmarkRoot = (workspaceFolder = process.cwd()) =>
  resolveProjectAiPath(workspaceFolder, process.env, 'benchmark')

const resolveSummary = (body: string) => {
  const lines = body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  return lines[0] ?? ''
}

export const listBenchmarkCases = async (options: BenchmarkListOptions = {}): Promise<BenchmarkCase[]> => {
  const workspaceFolder = options.workspaceFolder ?? process.cwd()
  const benchmarkRoot = resolveBenchmarkRoot(workspaceFolder)
  const pattern = options.category == null ? '*/*/rfc.md' : `${options.category}/*/rfc.md`
  const rfcPaths = await glob(pattern, {
    cwd: benchmarkRoot,
    absolute: true
  })

  const cases = await Promise.all(rfcPaths.map(async (rfcPath) => {
    const relativePath = relative(benchmarkRoot, rfcPath).split('\\').join('/')
    const [category, title] = relativePath.split('/')
    const caseDir = resolve(benchmarkRoot, category, title)
    const rfcRaw = await readFile(rfcPath, 'utf-8')
    const { body, attributes } = fm<Record<string, unknown>>(rfcRaw)
    const frontmatter = BenchmarkFrontmatterSchema.parse(attributes)
    const latestResult = await readBenchmarkResult(workspaceFolder, category, title)

    return {
      id: `${category}/${title}`,
      category,
      title,
      caseDir,
      rfcPath,
      patchPath: resolve(caseDir, 'patch.diff'),
      patchTestPath: resolve(caseDir, 'patch.test.diff'),
      rfcBody: body.trim(),
      rfcRaw,
      summary: resolveSummary(body),
      frontmatter,
      latestResult
    } satisfies BenchmarkCase
  }))

  return cases.sort((a, b) => a.id.localeCompare(b.id))
}

export const listBenchmarkCategories = async (options: BenchmarkListOptions = {}): Promise<BenchmarkCategory[]> => {
  const cases = await listBenchmarkCases(options)
  const categoryMap = new Map<string, BenchmarkCategory>()

  for (const item of cases) {
    const existing = categoryMap.get(item.category) ?? {
      category: item.category,
      caseCount: 0,
      lastStatuses: {
        pass: 0,
        partial: 0,
        fail: 0
      }
    }
    existing.caseCount += 1
    if (item.latestResult != null) {
      existing.lastStatuses[item.latestResult.status] += 1
    }
    categoryMap.set(item.category, existing)
  }

  return [...categoryMap.values()].sort((a, b) => a.category.localeCompare(b.category))
}

export const getBenchmarkCase = async (input: BenchmarkCaseSelector) => {
  const items = await listBenchmarkCases({
    workspaceFolder: input.workspaceFolder,
    category: input.category
  })
  return items.find(item => item.title === input.title) ?? null
}
