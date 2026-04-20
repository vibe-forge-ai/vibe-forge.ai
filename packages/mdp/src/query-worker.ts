import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import type { ResolvedMdpConnection } from './config'

interface McpToolResponse<T> {
  structuredContent?: T
  content?: Array<{ type?: string; text?: string }>
}

export interface QueryWorker {
  selectedHost: string
  callTool<T>(name: string, args?: Record<string, unknown>): Promise<T>
  close(): Promise<void>
}

const packageResolver = createRequire(
  typeof __filename === 'string'
    ? __filename
    : resolve(process.cwd(), '__vibe_forge_mdp_query_worker__.js')
)

const resolvePackageRootFromEntry = (entryPath: string) => {
  let currentDir = dirname(entryPath)

  while (true) {
    if (existsSync(resolve(currentDir, 'package.json'))) {
      return currentDir
    }
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error(`Failed to resolve package root for "${entryPath}"`)
    }
    currentDir = parentDir
  }
}

export const resolveMdpServerCliPath = (_cwd: string) => {
  const packageEntryPath = packageResolver.resolve('@modeldriveprotocol/server')
  const packageRoot = resolvePackageRootFromEntry(packageEntryPath)
  const cliPath = resolve(packageRoot, 'dist/cli.js')
  if (!existsSync(cliPath)) {
    throw new Error(`Failed to resolve MDP server CLI at "${cliPath}"`)
  }
  return cliPath
}

export const parseQueryWorkerToolResult = <T>(result: McpToolResponse<T>): T => {
  if (result.structuredContent != null) {
    return result.structuredContent
  }

  const text = result.content?.find(item => item.type === 'text')?.text
  if (text == null || text.trim() === '') {
    throw new Error('MDP query worker returned an empty result')
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text)
  }
}

const createWorkerForHost = async (
  cwd: string,
  host: string
): Promise<QueryWorker> => {
  const cliPath = resolveMdpServerCliPath(cwd)
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      cliPath,
      '--cluster-mode',
      'proxy-required',
      '--upstream-url',
      host
    ],
    cwd,
    stderr: 'pipe'
  })
  const client = new Client(
    {
      name: 'vibe-forge-mdp-query',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  )

  await client.connect(transport)
  await client.listTools()

  return {
    selectedHost: host,
    async callTool<T>(name: string, args?: Record<string, unknown>) {
      const result = await client.callTool({
        name,
        arguments: args
      }) as McpToolResponse<T>
      return parseQueryWorkerToolResult(result)
    },
    async close() {
      await transport.close()
    }
  }
}

export const withQueryWorker = async <T>(
  cwd: string,
  connection: ResolvedMdpConnection,
  run: (worker: QueryWorker) => Promise<T>
) => {
  let lastError: unknown

  for (const host of connection.hosts) {
    let worker: QueryWorker | undefined
    try {
      worker = await createWorkerForHost(cwd, host)
      try {
        return await run(worker)
      } finally {
        await worker.close().catch(() => {})
      }
    } catch (error) {
      lastError = error
      await worker?.close().catch(() => {})
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
