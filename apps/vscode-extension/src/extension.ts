import * as vscode from 'vscode'

import { SIDEBAR_VIEW_ID } from './constants'
import { ServerManager } from './server-manager'
import { VibeForgeSidebarProvider } from './sidebar-provider'

let activeManager: ServerManager | undefined

export function activate(context: vscode.ExtensionContext) {
  const manager = new ServerManager(context)
  const sidebarProvider = new VibeForgeSidebarProvider(context, manager)
  activeManager = manager

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SIDEBAR_VIEW_ID,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    ),
    vscode.commands.registerCommand('vibeForge.open', () => sidebarProvider.openWorkspace()),
    vscode.commands.registerCommand('vibeForge.reloadView', () => sidebarProvider.reload()),
    vscode.commands.registerCommand('vibeForge.restartServer', () => sidebarProvider.restart()),
    vscode.commands.registerCommand('vibeForge.stopServer', () => sidebarProvider.stop()),
    vscode.commands.registerCommand('vibeForge.stopAllServers', () => sidebarProvider.stopAll()),
    vscode.commands.registerCommand('vibeForge.openExternal', () => sidebarProvider.openExternal()),
    {
      dispose: () => {
        void manager.stopAll()
        if (activeManager === manager) {
          activeManager = undefined
        }
      }
    }
  )
}

export function deactivate() {
  return activeManager?.stopAll()
}
