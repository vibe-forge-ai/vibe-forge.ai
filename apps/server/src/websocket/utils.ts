import { WebSocket } from 'ws'

import type { WSEvent } from '@vibe-forge/core'

import { safeJsonStringify } from '#~/utils/json.js'

export function sendToClient(ws: WebSocket, event: WSEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(safeJsonStringify(event))
  }
}

export const mergeRecord = <T>(left?: Record<string, T>, right?: Record<string, T>) => {
  if (left == null && right == null) return undefined
  return {
    ...(left ?? {}),
    ...(right ?? {})
  }
}
