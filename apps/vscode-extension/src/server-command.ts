import process from 'node:process'

import type * as vscode from 'vscode'

import { createSearchPath, findExecutable } from './path-search'
import { normalizeOptionalString } from './utils'

const BOOTSTRAP_COMMAND_CANDIDATES = ['vibe-forge-bootstrap', 'vfb']

export interface ResolvedBootstrapCommand {
  command: string
  shell: boolean
  source: string
}

const getConfiguredBootstrapCommand = () => (
  normalizeOptionalString(process.env.VF_VSCODE_BOOTSTRAP_COMMAND)
)

export const resolveBootstrapCommand = (
  workspaceFolder: vscode.WorkspaceFolder,
  configuredCommand: string | undefined
): ResolvedBootstrapCommand | undefined => {
  const searchPaths = createSearchPath(workspaceFolder.uri.fsPath)
  if (configuredCommand != null) {
    const executable = findExecutable(configuredCommand, searchPaths)
    return {
      command: executable ?? configuredCommand,
      shell: executable == null,
      source: executable == null ? 'settings' : `settings:${executable}`
    }
  }

  const envCommand = getConfiguredBootstrapCommand()
  if (envCommand != null) {
    const executable = findExecutable(envCommand, searchPaths)
    return {
      command: executable ?? envCommand,
      shell: executable == null,
      source: executable == null ? 'env' : `env:${executable}`
    }
  }

  for (const candidate of BOOTSTRAP_COMMAND_CANDIDATES) {
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

export const createMissingBootstrapCommandMessage = () => (
  [
    'Vibe Forge bootstrap command was not found.',
    '',
    'Install the Vibe Forge bootstrap launcher:',
    'pnpm add -D @vibe-forge/bootstrap',
    '',
    'Or install the Homebrew launcher:',
    'brew install vibe-forge-ai/tap/vibe-forge-bootstrap',
    '',
    'Or configure `vibeForge.bootstrapCommand` with a `vibe-forge-bootstrap` executable or wrapper command.'
  ].join('\n')
)
