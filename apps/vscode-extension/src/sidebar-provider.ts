import * as vscode from 'vscode'

import { SIDEBAR_VIEW_ID, VIEW_CONTAINER_ID } from './constants'
import type { ManagedServer, ServerManager } from './server-manager'
import { createErrorHtml, createLoadingHtml, createStatusHtml, createWebviewHtml } from './webview-html'
import { getPreferredWorkspaceFolder, pickWorkspaceFolder } from './workspace'

type RenderMode = 'start' | 'restart'

interface RenderRequest {
  mode: RenderMode
  workspaceFolder: vscode.WorkspaceFolder
}

export class VibeForgeSidebarProvider implements vscode.WebviewViewProvider {
  private activeServer: ManagedServer | undefined
  private activeWorkspaceFolder: vscode.WorkspaceFolder | undefined
  private renderSequence = 0
  private view: vscode.WebviewView | undefined

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly manager: ServerManager
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView
    webviewView.title = 'Vibe Forge'
    webviewView.webview.options = {
      enableScripts: true
    }
    webviewView.onDidDispose(
      () => {
        if (this.view === webviewView) {
          this.view = undefined
        }
      },
      undefined,
      this.context.subscriptions
    )

    const workspaceFolder = this.activeWorkspaceFolder ?? getPreferredWorkspaceFolder()
    if (workspaceFolder == null) {
      this.renderStatus('Open a workspace', 'Vibe Forge needs a local workspace folder to start a project server.')
      return
    }

    void this.showWorkspace(workspaceFolder, 'start', { reveal: false })
  }

  async openWorkspace() {
    const workspaceFolder = await pickWorkspaceFolder()
    if (workspaceFolder == null) return
    await this.showWorkspace(workspaceFolder)
  }

  async reload() {
    const workspaceFolder = await this.getActiveOrPickedWorkspace()
    if (workspaceFolder == null) return
    await this.showWorkspace(workspaceFolder)
  }

  async restart() {
    const workspaceFolder = await this.getActiveOrPickedWorkspace()
    if (workspaceFolder == null) return
    await this.showWorkspace(workspaceFolder, 'restart')
    void vscode.window.showInformationMessage(`Vibe Forge restarted for ${workspaceFolder.name}.`)
  }

  async stop() {
    const workspaceFolder = await this.getActiveOrPickedWorkspace()
    if (workspaceFolder == null) return
    await this.manager.stop(workspaceFolder)
    if (this.activeWorkspaceFolder?.uri.fsPath === workspaceFolder.uri.fsPath) {
      this.activeServer = undefined
      this.renderStatus('Vibe Forge stopped', workspaceFolder.uri.fsPath)
    }
    void vscode.window.showInformationMessage(`Vibe Forge stopped for ${workspaceFolder.name}.`)
  }

  async stopAll() {
    await this.manager.stopAll()
    this.activeServer = undefined
    this.renderStatus('Vibe Forge stopped', 'All project servers have been stopped.')
    void vscode.window.showInformationMessage('Vibe Forge servers stopped.')
  }

  async openExternal() {
    const workspaceFolder = await this.getActiveOrPickedWorkspace()
    if (workspaceFolder == null) return
    const server = await this.manager.start(workspaceFolder)
    this.activeServer = server
    await vscode.env.openExternal(vscode.Uri.parse(server.url))
  }

  private async getActiveOrPickedWorkspace() {
    return this.activeWorkspaceFolder ?? (await pickWorkspaceFolder())
  }

  private async revealView() {
    await vscode.commands.executeCommand(`workbench.view.extension.${VIEW_CONTAINER_ID}`)
    await vscode.commands.executeCommand(`${SIDEBAR_VIEW_ID}.focus`)
  }

  private renderStatus(title: string, detail: string) {
    if (this.view == null) return
    this.view.description = undefined
    this.view.webview.html = createStatusHtml(title, detail)
  }

  private async showWorkspace(
    workspaceFolder: vscode.WorkspaceFolder,
    mode: RenderMode = 'start',
    options: { reveal?: boolean } = {}
  ) {
    this.activeWorkspaceFolder = workspaceFolder
    if (options.reveal !== false) {
      await this.revealView()
    }
    await this.render({ mode, workspaceFolder })
  }

  private async render({ mode, workspaceFolder }: RenderRequest) {
    if (this.view == null) return

    const sequence = ++this.renderSequence
    const view = this.view
    view.description = workspaceFolder.name
    view.webview.html = createLoadingHtml(workspaceFolder)

    try {
      const server = mode === 'restart'
        ? await this.manager.restart(workspaceFolder)
        : await this.manager.start(workspaceFolder)
      if (this.view !== view || sequence !== this.renderSequence) return
      this.activeServer = server
      view.webview.html = createWebviewHtml(view.webview, server)
    } catch (error) {
      if (this.view !== view || sequence !== this.renderSequence) return
      const message = error instanceof Error ? error.message : String(error)
      this.activeServer = undefined
      view.webview.html = createErrorHtml(message)
      void vscode.window.showErrorMessage(message)
    }
  }
}
