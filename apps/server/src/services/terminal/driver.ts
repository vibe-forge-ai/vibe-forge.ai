import { spawn as spawnProcess } from 'node:child_process'
import { chmodSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { spawn as spawnPty } from 'node-pty'

import type { TerminalRuntime } from './store'

const SHELL_ARGS = process.platform === 'win32' ? [] : ['-i']
let ptyHelperReady = false

const buildTerminalEnv = () => {
  return {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor'
  }
}

const ensureNodePtyHelperExecutable = () => {
  if (ptyHelperReady || process.platform === 'win32') {
    return
  }

  const packageRoot = path.dirname(require.resolve('node-pty/package.json'))
  const candidatePaths = [
    path.join(packageRoot, 'build', 'Release', 'spawn-helper'),
    path.join(packageRoot, 'build', 'Debug', 'spawn-helper'),
    path.join(packageRoot, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper')
  ]

  for (const helperPath of candidatePaths) {
    if (!existsSync(helperPath)) {
      continue
    }

    const mode = statSync(helperPath).mode & 0o777
    if ((mode & 0o111) === 0) {
      chmodSync(helperPath, mode | 0o755)
    }
  }

  ptyHelperReady = true
}

export function createPtyDriver({
  shell,
  cwd,
  cols,
  rows,
  onData,
  onExit
}: {
  shell: string
  cwd: string
  cols: number
  rows: number
  onData: (data: string) => void
  onExit: (params: { exitCode: number | null; signal: number | null }) => void
}): NonNullable<TerminalRuntime['driver']> {
  ensureNodePtyHelperExecutable()

  const pty = spawnPty(shell, SHELL_ARGS, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: buildTerminalEnv()
  })

  pty.onData(onData)
  pty.onExit(({ exitCode, signal }) => {
    onExit({
      exitCode: exitCode ?? null,
      signal: signal ?? null
    })
  })

  return {
    kind: 'pty',
    pid: pty.pid,
    write: (data) => {
      pty.write(data)
    },
    resize: (nextCols, nextRows) => {
      pty.resize(nextCols, nextRows)
    },
    kill: () => {
      pty.kill()
    }
  }
}

export function createPipeDriver({
  shell,
  cwd,
  onData,
  onExit,
  onError
}: {
  shell: string
  cwd: string
  onData: (data: string) => void
  onExit: (params: { exitCode: number | null; signal: number | null }) => void
  onError: (error: unknown) => void
}): NonNullable<TerminalRuntime['driver']> {
  const child = spawnProcess(shell, SHELL_ARGS, {
    cwd,
    env: buildTerminalEnv(),
    stdio: 'pipe'
  })

  child.stdout.on('data', (data) => {
    onData(String(data))
  })

  child.stderr.on('data', (data) => {
    onData(String(data))
  })

  child.once('error', onError)
  child.once('exit', (exitCode) => {
    onExit({
      exitCode: exitCode ?? null,
      signal: null
    })
  })

  return {
    kind: 'pipe',
    pid: child.pid ?? undefined,
    write: (data) => {
      child.stdin.write(data)
    },
    resize: () => undefined,
    kill: () => {
      child.kill()
    }
  }
}
