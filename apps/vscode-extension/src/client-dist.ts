import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import * as vscode from 'vscode'

import { normalizeOptionalString } from './utils'

const getConfig = () => vscode.workspace.getConfiguration('vibeForge')

const isClientDistPath = (candidate: string | undefined) => (
  candidate != null && existsSync(path.join(candidate, 'index.html'))
)

export const resolveClientDistPath = (workspaceFolder: vscode.WorkspaceFolder) => {
  const configuredPath = normalizeOptionalString(getConfig().get('clientDistPath'))
  const workspacePath = workspaceFolder.uri.fsPath
  const candidates = [
    configuredPath,
    normalizeOptionalString(process.env.VF_VSCODE_CLIENT_DIST_PATH),
    path.join(workspacePath, 'node_modules/@vibe-forge/client/dist'),
    path.join(workspacePath, 'apps/client/dist'),
    path.join(workspacePath, 'client/dist')
  ]

  return candidates.find(isClientDistPath)
}
