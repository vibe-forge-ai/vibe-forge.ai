import type { TerminalSessionCommand } from '@vibe-forge/types'

import { getSessionLogger } from '#~/utils/logger.js'

import { resizeTerminalSession, restartTerminalSession } from './runtime'
import { clearIdleTimer, closeTerminalSocket, sendTerminalEvent, terminalRuntimeStore } from './store'

export function terminateTerminalSession(sessionId: string) {
  const runtime = terminalRuntimeStore.get(sessionId)
  if (runtime?.driver == null) {
    return
  }

  getSessionLogger(sessionId, 'server').info({ sessionId }, '[terminal] Terminating shell session')
  runtime.driver.kill()
}

export function disposeTerminalSession(sessionId: string) {
  const runtime = terminalRuntimeStore.get(sessionId)
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
  terminalRuntimeStore.delete(sessionId)
  runtime.driver?.kill()
  for (const socket of sockets) {
    closeTerminalSocket(socket, 1000, 'Terminal session was closed.')
  }
}

export function handleTerminalCommand(sessionId: string, command: TerminalSessionCommand) {
  switch (command.type) {
    case 'terminal_input': {
      const runtime = terminalRuntimeStore.get(sessionId)
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
      resizeTerminalSession(sessionId, { cols: command.cols, rows: command.rows })
      return
    case 'terminal_restart':
      restartTerminalSession(sessionId, { cols: command.cols, rows: command.rows })
      return
    case 'terminal_terminate':
      terminateTerminalSession(sessionId)
  }
}
