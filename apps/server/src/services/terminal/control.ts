import type { TerminalSessionCommand } from '@vibe-forge/types'

import { getSessionLogger } from '#~/utils/logger.js'

import { resizeTerminalSession, restartTerminalSession } from './runtime'
import {
  clearIdleTimer,
  closeTerminalSocket,
  getTerminalRuntime,
  sendTerminalEvent,
  terminalRuntimeStore
} from './store'

export function terminateTerminalSession(sessionId: string, terminalId?: string) {
  const runtime = getTerminalRuntime(sessionId, terminalId)
  if (runtime?.driver == null) {
    return
  }

  getSessionLogger(sessionId, 'server').info(
    { sessionId, terminalId: runtime.terminalId },
    '[terminal] Terminating shell session'
  )
  runtime.driver.kill()
}

const disposeTerminalRuntime = (runtimeKey: string) => {
  const runtime = terminalRuntimeStore.get(runtimeKey)
  if (runtime == null) {
    return
  }

  clearIdleTimer(runtime)
  const sockets = [...runtime.sockets]
  for (const socket of sockets) {
    sendTerminalEvent(socket, {
      type: 'terminal_error',
      message: 'Terminal session was closed.',
      fatal: true
    })
  }

  runtime.sockets.clear()
  terminalRuntimeStore.delete(runtime.runtimeKey)
  runtime.driver?.kill()
  for (const socket of sockets) {
    closeTerminalSocket(socket, 1000, 'Terminal session was closed.')
  }
}

export function disposeTerminalSession(sessionId: string, terminalId?: string) {
  if (terminalId != null) {
    const runtime = getTerminalRuntime(sessionId, terminalId)
    if (runtime != null) {
      disposeTerminalRuntime(runtime.runtimeKey)
    }
    return
  }

  for (const [runtimeKey, runtime] of terminalRuntimeStore) {
    if (runtime.sessionId === sessionId) {
      disposeTerminalRuntime(runtimeKey)
    }
  }
}

export function handleTerminalCommand(sessionId: string, command: TerminalSessionCommand, terminalId?: string) {
  switch (command.type) {
    case 'terminal_input': {
      const runtime = getTerminalRuntime(sessionId, terminalId)
      if (runtime?.driver == null) {
        runtime?.sockets.forEach((socket) => {
          sendTerminalEvent(socket, {
            type: 'terminal_error',
            message: 'Terminal session is not running.'
          })
        })
        return
      }

      runtime.driver.write(command.data)
      return
    }
    case 'terminal_resize':
      resizeTerminalSession(sessionId, { terminalId, cols: command.cols, rows: command.rows })
      return
    case 'terminal_restart':
      restartTerminalSession(sessionId, { terminalId, cols: command.cols, rows: command.rows })
      return
    case 'terminal_terminate':
      terminateTerminalSession(sessionId, terminalId)
  }
}
