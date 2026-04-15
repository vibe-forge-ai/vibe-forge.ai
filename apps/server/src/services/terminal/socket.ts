import type { WebSocket } from 'ws'

import { resolveSessionWorkspaceFolder } from '#~/services/session/workspace.js'
import { resizeTerminalSession, startTerminalSession } from './runtime'
import {
  buildReadyEvent,
  clearIdleTimer,
  ensureTerminalRuntime,
  scheduleTerminalRuntimeDispose,
  sendTerminalEvent,
  terminalRuntimeStore
} from './store'

export async function attachTerminalSocket(
  sessionId: string,
  socket: WebSocket,
  options: {
    cols?: number
    rows?: number
  } = {}
) {
  const cwd = await resolveSessionWorkspaceFolder(sessionId)
  let runtime = ensureTerminalRuntime(sessionId, {
    ...options,
    cwd
  })
  clearIdleTimer(runtime)

  if (!runtime.started) {
    runtime = startTerminalSession(sessionId, {
      ...options,
      cwd
    })
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
