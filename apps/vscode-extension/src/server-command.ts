import process from 'node:process'

import type * as vscode from 'vscode'

import { createSearchPath, findExecutable } from './path-search'
import { normalizeOptionalString } from './utils'

const SERVER_COMMAND_CANDIDATES = ['vfui-server', 'vibe-forge-ui-server']

export interface ResolvedServerCommand {
  command: string
  shell: boolean
  source: string
}

const getConfiguredServerCommand = () => (
  normalizeOptionalString(process.env.VF_VSCODE_SERVER_COMMAND)
)

export const resolveServerCommand = (
  workspaceFolder: vscode.WorkspaceFolder,
  configuredCommand: string | undefined
): ResolvedServerCommand | undefined => {
  const searchPaths = createSearchPath(workspaceFolder.uri.fsPath)
  if (configuredCommand != null) {
    const executable = findExecutable(configuredCommand, searchPaths)
    return {
      command: executable ?? configuredCommand,
      shell: executable == null,
      source: executable == null ? 'settings' : `settings:${executable}`
    }
  }

  const envCommand = getConfiguredServerCommand()
  if (envCommand != null) {
    const executable = findExecutable(envCommand, searchPaths)
    return {
      command: executable ?? envCommand,
      shell: executable == null,
      source: executable == null ? 'env' : `env:${executable}`
    }
  }

  for (const candidate of SERVER_COMMAND_CANDIDATES) {
    const executable = findExecutable(candidate, searchPaths)
    if (executable != null) {
      return {
        command: executable,
        shell: false,
        source: executable
      }
    }
  }

  return undefined
}

export const createMissingServerCommandMessage = () => (
  [
    'Vibe Forge server command was not found.',
    '',
    'Install Vibe Forge UI packages in this workspace:',
    'pnpm add -D @vibe-forge/server @vibe-forge/client',
    '',
    'Or configure `vibeForge.serverCommand` with a `vfui-server` executable or wrapper command.'
  ].join('\n')
)
