import type { WSEvent } from '@vibe-forge/core'

const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname
const SERVER_PORT = import.meta.env.VITE_SERVER_PORT || '8787'
const WS_URL = `ws://${SERVER_HOST}:${SERVER_PORT}/ws`

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
