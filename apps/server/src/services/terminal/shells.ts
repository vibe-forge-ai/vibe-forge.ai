import process from 'node:process'

import type { TerminalShellKind } from '@vibe-forge/types'

const TERMINAL_SHELL_KINDS = new Set<TerminalShellKind>([
  'default',
  'zsh',
  'bash',
  'sh',
  'powershell',
  'cmd'
])

export const normalizeTerminalShellKind = (value: string | null | undefined): TerminalShellKind => {
  return TERMINAL_SHELL_KINDS.has(value as TerminalShellKind) ? value as TerminalShellKind : 'default'
}

export const resolveTerminalShell = (shellKind: TerminalShellKind = 'default') => {
  if (process.platform === 'win32') {
    switch (shellKind) {
      case 'cmd':
        return process.env.COMSPEC?.trim() || 'cmd.exe'
      case 'powershell':
      case 'default':
      case 'zsh':
      case 'bash':
      case 'sh':
        return process.env.COMSPEC?.trim() || 'powershell.exe'
    }
  }

  switch (shellKind) {
    case 'zsh':
      return 'zsh'
    case 'bash':
      return 'bash'
    case 'sh':
      return 'sh'
    case 'powershell':
      return 'pwsh'
    case 'cmd':
    case 'default':
      return process.env.SHELL?.trim() || 'bash'
  }
}
