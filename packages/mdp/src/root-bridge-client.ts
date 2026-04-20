import process from 'node:process'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import { parseQueryWorkerToolResult } from './query-worker'
import type { MdpBridgeRequest, MdpBridgeResponse } from './bridge'
import { resolveMdpServerCliPath } from './query-worker'

interface McpToolResponse<T> {
  structuredContent?: T
  content?: Array<{ type?: string; text?: string }>
}

export interface ManagedLocalRootBridgeClient {
  close(): Promise<void>
  request(request: MdpBridgeRequest): Promise<MdpBridgeResponse>
}

const callBridgeTool = async <T>(
  client: Client,
  name: string,
  args?: Record<string, unknown>
) => {
  const result = await client.callTool({
    name,
    arguments: args
  }) as McpToolResponse<T>

  return parseQueryWorkerToolResult(result)
}

export const startManagedLocalRootBridgeClient = async (params: {
  cwd: string
  targetUrl: string
  stateStoreDir: string
  serverId: string
}): Promise<ManagedLocalRootBridgeClient> => {
  const target = new URL(params.targetUrl)
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      resolveMdpServerCliPath(params.cwd),
      '--cluster-mode',
      'standalone',
      '--host',
      target.hostname,
      '--port',
      String(target.port || '47372'),
      '--state-store-dir',
      params.stateStoreDir,
      '--server-id',
      params.serverId
    ],
    cwd: params.cwd,
    stderr: 'pipe'
  })
  const client = new Client(
    {
      name: 'vibe-forge-mdp-root-manager',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  )

  await client.connect(transport)
  await client.listTools()

  return {
    async close() {
      await Promise.allSettled([
        client.close(),
        transport.close()
      ])
    },
    async request(request) {
      switch (request.method) {
        case 'listClients':
          return await callBridgeTool<MdpBridgeResponse>(client, 'listClients', request.params)
        case 'listPaths':
          return await callBridgeTool<MdpBridgeResponse>(client, 'listPaths', request.params)
        case 'callPath':
          return await callBridgeTool<MdpBridgeResponse>(client, 'callPath', request.params)
        case 'callPaths':
          return await callBridgeTool<MdpBridgeResponse>(client, 'callPaths', request.params)
      }
    }
  }
}
