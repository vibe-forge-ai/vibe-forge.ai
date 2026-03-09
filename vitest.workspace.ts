import fs from 'node:fs'
import path from 'node:path'

import { defineWorkspace } from 'vitest/config'

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**'
]

const readTsconfigIncludes = (fileName: string) => {
  const filePath = path.resolve('packages/tsconfigs', fileName)
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw) as { include?: string[] }
  return Array.isArray(json.include) ? json.include : []
}

const extractBase = (value: string) => {
  return value
    .replace(/\\/g, '/')
    .replace(/^(\.\.\/)+/, '')
}

const stripGlobSuffix = (value: string) => {
  return value
    .replace(/\/\*\*\/\*$/, '')
    .replace(/\/\*\*$/, '')
    .replace(/\/\*$/, '')
}

const buildTestIncludes = (includes: string[], extensions: string) => {
  const bases = includes
    .filter((value) => value.includes('*'))
    .map(extractBase)
    .filter((value): value is string => Boolean(value))
    .map(stripGlobSuffix)
  const unique = Array.from(new Set(bases))
  const globs = unique.flatMap((base) => {
    const entries = [`${base}/**/*.{test,spec}.${extensions}`]
    if (base.endsWith('/src')) {
      entries.push(`${base.slice(0, -4)}/__tests__/**/*.{test,spec}.${extensions}`)
    }
    return entries
  })
  return Array.from(new Set(globs))
}

const nodeIncludes = buildTestIncludes(
  readTsconfigIncludes('tsconfig.node.test.json'),
  'ts'
)
const bundlerIncludes = buildTestIncludes(
  readTsconfigIncludes('tsconfig.bundler.test.json'),
  'ts'
)
const webIncludes = buildTestIncludes(
  readTsconfigIncludes('tsconfig.bundler.web.test.json'),
  '{ts,tsx}'
)

export default defineWorkspace([
  {
    resolve: {
      conditions: ['__vibe-forge__']
    },
    test: {
      name: 'node',
      environment: 'node',
      include: nodeIncludes,
      exclude
    }
  },
  {
    resolve: {
      conditions: ['__vibe-forge__']
    },
    test: {
      name: 'bundler',
      environment: 'node',
      include: bundlerIncludes,
      exclude
    }
  },
  {
    resolve: {
      conditions: ['__vibe-forge__']
    },
    test: {
      name: 'bundler.web',
      environment: 'node',
      include: webIncludes,
      exclude
    }
  }
])
