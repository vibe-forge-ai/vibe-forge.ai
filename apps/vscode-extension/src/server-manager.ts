import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import type { ChildProcess } from 'node:child_process'
import * as vscode from 'vscode'

import { resolveClientDistPath } from './client-dist'
import { CLIENT_BASE, SERVER_HOST } from './constants'
import { createProcessPath } from './path-search'
import { createMissingServerCommandMessage, resolveServerCommand } from './server-command'
import { assertServerUiReady, getAvailablePort, isRunning, stopChild, waitForServerStartup } from './server-process'
import { normalizeOptionalString } from './utils'

export interface ManagedServer {
  child: ChildProcess
  port: number
  url: string
  workspaceFolder: vscode.WorkspaceFolder
}

const getConfig = () => vscode.workspace.getConfiguration('vibeForge')

export class ServerManager {
  private readonly output: vscode.OutputChannel
  private readonly servers = new Map<string, ManagedServer>()
  private readonly starts = new Map<string, Promise<ManagedServer>>()

  constructor(
    private readonly context: vscode.ExtensionContext
  ) {
    this.output = vscode.window.createOutputChannel('Vibe Forge')
    this.context.subscriptions.push(this.output)
  }

  async start(workspaceFolder: vscode.WorkspaceFolder) {
    const key = workspaceFolder.uri.fsPath
    const existing = this.servers.get(key)
    if (existing != null && isRunning(existing.child)) {
      return existing
    }

    const pending = this.starts.get(key)
    if (pending != null) {
      return pending
    }

    const startPromise = this.createServer(workspaceFolder)
      .finally(() => this.starts.delete(key))
    this.starts.set(key, startPromise)
    return startPromise
  }

  async restart(workspaceFolder: vscode.WorkspaceFolder) {
    await this.stop(workspaceFolder)
    return this.start(workspaceFolder)
  }

  async stop(workspaceFolder: vscode.WorkspaceFolder) {
    const key = workspaceFolder.uri.fsPath
    const server = this.servers.get(key)
    this.servers.delete(key)
    if (server != null) {
      await stopChild(server.child)
    }
  }

  async stopAll() {
    const servers = [...this.servers.values()]
    this.servers.clear()
    await Promise.all(servers.map(server => stopChild(server.child)))
  }

  private getWorkspaceDataDir(workspaceFolder: vscode.WorkspaceFolder) {
    const hash = createHash('sha256')
      .update(workspaceFolder.uri.fsPath)
      .digest('hex')
      .slice(0, 16)
    const dataDir = path.join(this.context.globalStorageUri.fsPath, 'servers', hash)
    mkdirSync(dataDir, { recursive: true })
    return dataDir
  }

  private createServer = async (workspaceFolder: vscode.WorkspaceFolder) => {
    const configuredServerCommand = normalizeOptionalString(getConfig().get('serverCommand'))
    const serverCommand = resolveServerCommand(workspaceFolder, configuredServerCommand)
    if (serverCommand == null) {
      throw new Error(createMissingServerCommandMessage())
    }

    const clientDistPath = resolveClientDistPath(workspaceFolder)
    const port = await getAvailablePort()
    const dataDir = this.getWorkspaceDataDir(workspaceFolder)
    this.output.appendLine(`[server:${workspaceFolder.name}] starting ${serverCommand.source}`)
    if (clientDistPath != null) {
      this.output.appendLine(`[server:${workspaceFolder.name}] client dist ${clientDistPath}`)
    } else {
      this.output.appendLine(
        `[server:${workspaceFolder.name}] client dist not configured; relying on vfui-server fallback`
      )
    }

    const child = spawn(serverCommand.command, [], {
      cwd: workspaceFolder.uri.fsPath,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        DB_PATH: path.join(dataDir, 'db.sqlite'),
        PATH: createProcessPath(workspaceFolder.uri.fsPath),
        __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder.uri.fsPath,
        __VF_PROJECT_AI_CLIENT_BASE__: CLIENT_BASE,
        ...(clientDistPath != null ? { __VF_PROJECT_AI_CLIENT_DIST_PATH__: clientDistPath } : {}),
        __VF_PROJECT_AI_CLIENT_MODE__: 'independent',
        __VF_PROJECT_AI_SERVER_DATA_DIR__: path.join(dataDir, 'data'),
        __VF_PROJECT_AI_SERVER_HOST__: SERVER_HOST,
        __VF_PROJECT_AI_SERVER_LOG_DIR__: path.join(dataDir, 'logs'),
        __VF_PROJECT_AI_SERVER_PORT__: String(port),
        __VF_PROJECT_AI_WEB_AUTH_ENABLED__: 'false'
      },
      shell: serverCommand.shell,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout?.on(
      'data',
      data => this.output.appendLine(`[server:${workspaceFolder.name}] ${String(data).trimEnd()}`)
    )
    child.stderr?.on(
      'data',
      data => this.output.appendLine(`[server:${workspaceFolder.name}] ${String(data).trimEnd()}`)
    )
    child.once('exit', (code, signal) => {
      const current = this.servers.get(workspaceFolder.uri.fsPath)
      if (current?.child === child) {
        this.servers.delete(workspaceFolder.uri.fsPath)
      }
      this.output.appendLine(
        `[server:${workspaceFolder.name}] exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`
      )
    })

    try {
      await waitForServerStartup(child, port)
      await assertServerUiReady(port)
    } catch (error) {
      await stopChild(child)
      throw error
    }

    const server: ManagedServer = {
      child,
      port,
      url: `http://${SERVER_HOST}:${port}${CLIENT_BASE}/`,
      workspaceFolder
    }
    this.servers.set(workspaceFolder.uri.fsPath, server)
    return server
  }
}
