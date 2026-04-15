import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'

import { glob } from 'fast-glob'
import { resolveProjectAiPath } from '@vibe-forge/utils'

import { BenchmarkResultSchema } from './schema'
import type { BenchmarkResult } from './schema'
import { readTextIfExists } from './utils'

export const resolveBenchmarkResultPath = (workspaceFolder: string, category: string, title: string) =>
  resolveProjectAiPath(workspaceFolder, process.env, 'results', category, title, 'result.json')

export const readBenchmarkResult = async (workspaceFolder: string, category: string, title: string) => {
  const resultPath = resolveBenchmarkResultPath(workspaceFolder, category, title)
  const raw = await readTextIfExists(resultPath)
  if (raw == null) return null
  const parsed = JSON.parse(raw) as unknown
  return BenchmarkResultSchema.parse(parsed)
}

export const writeBenchmarkResult = async (workspaceFolder: string, result: BenchmarkResult) => {
  const resultPath = resolveBenchmarkResultPath(workspaceFolder, result.category, result.title)
  await mkdir(dirname(resultPath), { recursive: true })
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  return resultPath
}

export const listBenchmarkResults = async (workspaceFolder = process.cwd(), category?: string) => {
  const resultRoot = resolveProjectAiPath(workspaceFolder, process.env, 'results')
  const pattern = category == null
    ? '*/*/result.json'
    : `${category}/*/result.json`
  const resultPaths = await glob(pattern, {
    cwd: resultRoot,
    absolute: true
  })

  const results = await Promise.all(resultPaths.map(async (resultPath) => {
    const raw = await readTextIfExists(resultPath)
    if (raw == null) return null
    return BenchmarkResultSchema.parse(JSON.parse(raw) as unknown)
  }))

  return results
    .filter((result): result is BenchmarkResult => result != null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
