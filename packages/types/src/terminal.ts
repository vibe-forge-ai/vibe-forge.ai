export type TerminalShellKind = 'default' | 'zsh' | 'bash' | 'sh' | 'powershell' | 'cmd'

export interface TerminalSessionInfo {
  sessionId: string
  terminalId?: string
  shellKind?: TerminalShellKind
  cwd: string
  shell: string
  cols: number
  rows: number
  status: 'running' | 'exited'
  pid?: number
}

export type TerminalSessionEvent =
  | { type: 'terminal_ready'; info: TerminalSessionInfo; scrollback?: string }
  | { type: 'terminal_output'; data: string }
  | { type: 'terminal_exit'; exitCode: number | null; signal: number | null }
  | { type: 'terminal_error'; message: string; fatal?: boolean }

export type TerminalSessionCommand =
  | { type: 'terminal_input'; data: string }
  | { type: 'terminal_resize'; cols: number; rows: number }
  | { type: 'terminal_restart'; cols?: number; rows?: number }
  | { type: 'terminal_terminate' }
