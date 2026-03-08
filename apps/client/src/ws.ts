import type { WSEvent } from '@vibe-forge/core'

import { getServerHostEnv, getServerPortEnv, getServerWsPath } from '#~/runtime-config.js'

const SERVER_HOST = getServerHostEnv() || window.location.hostname
const SERVER_PORT = getServerPortEnv() || '8787'
const WS_URL = `ws://${SERVER_HOST}:${SERVER_PORT}${getServerWsPath()}`

export interface WSHandlers {
  onOpen?: () => void
  onMessage?: (data: WSEvent) => void
  onError?: (err: Event) => void
  onClose?: () => void
}

export function createSocket(handlers: WSHandlers, params?: Record<string, string>) {
  let url = WS_URL
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += (url.includes('?') ? '&' : '?') + searchParams.toString()
  }
  const ws = new WebSocket(url)
  ws.addEventListener('open', () => handlers.onOpen?.())
  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as unknown
      handlers.onMessage?.(data as WSEvent)
    } catch (e) {
      console.error(e)
    }
  })
  ws.addEventListener('error', (err) => handlers.onError?.(err))
  ws.addEventListener('close', () => handlers.onClose?.())
  return ws
}
