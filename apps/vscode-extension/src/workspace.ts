import path from 'node:path'

import * as vscode from 'vscode'

const getFileWorkspaceFolders = () =>
  vscode.workspace.workspaceFolders?.filter(folder => folder.uri.scheme === 'file') ?? []

const createWorkspaceFolderFromUri = (uri: vscode.Uri) =>
  ({
    index: 0,
    name: path.basename(uri.fsPath) || uri.fsPath,
    uri
  }) satisfies vscode.WorkspaceFolder

export const getPreferredWorkspaceFolder = () => {
  const folders = getFileWorkspaceFolders()
  const activeUri = vscode.window.activeTextEditor?.document.uri
  if (activeUri != null) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeUri)
    if (activeFolder != null && activeFolder.uri.scheme === 'file') {
      return activeFolder
    }
  }

  if (folders.length === 1) {
    return folders[0]
  }

  return folders[0]
}

export const pickWorkspaceFolder = async () => {
  const folders = getFileWorkspaceFolders()
  if (folders.length === 0) {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Open'
    })
    const folderUri = selected?.[0]
    return folderUri == null ? undefined : createWorkspaceFolderFromUri(folderUri)
  }

  const preferredFolder = getPreferredWorkspaceFolder()
  if (folders.length === 1 || preferredFolder == null) {
    return preferredFolder
  }

  const picked = await vscode.window.showQuickPick(
    folders.map(folder => ({
      description: folder.uri.fsPath,
      folder,
      label: folder.name
    })),
    {
      placeHolder: 'Select a workspace'
    }
  )
  return picked?.folder
}
