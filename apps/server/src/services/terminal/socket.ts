import type { WebSocket } from 'ws'

import { resizeTerminalSession, startTerminalSession } from './runtime'
import {
  buildReadyEvent,
  clearIdleTimer,
  ensureTerminalRuntime,
  scheduleTerminalRuntimeDispose,
  sendTerminalEvent,
  terminalRuntimeStore
} from './store'

export function attachTerminalSocket(
  sessionId: string,
  socket: WebSocket,
  options: {
    cols?: number
    rows?: number
  } = {}
) {
  let runtime = ensureTerminalRuntime(sessionId, options)
  clearIdleTimer(runtime)

  if (!runtime.started) {
    runtime = startTerminalSession(sessionId, options)
  } else if (runtime.driver != null) {
    runtime = resizeTerminalSession(sessionId, options)
  }

  const readyEvent = buildReadyEvent(runtime)
  runtime.sockets.add(socket)
  sendTerminalEvent(socket, readyEvent)
  return runtime
}

export function detachTerminalSocket(sessionId: string, socket: WebSocket) {
  const runtime = terminalRuntimeStore.get(sessionId)
  if (runtime == null) {
    return
  }

  runtime.sockets.delete(socket)
  if (runtime.sockets.size === 0) {
    scheduleTerminalRuntimeDispose(sessionId)
  }
}
