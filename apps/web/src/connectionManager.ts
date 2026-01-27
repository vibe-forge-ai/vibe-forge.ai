import type { WSEvent } from '@vibe-forge/core'
import { createSocket } from './ws'
import type { WSHandlers } from './ws'

class ConnectionManager {
  private sockets = new Map<string, WebSocket>()
  private subscribers = new Map<string, Set<WSHandlers>>()
  private disconnectTimers = new Map<string, NodeJS.Timeout>()
  
  // Keep connection alive for 60 seconds after last subscriber leaves
  // This allows for quick navigation between sessions without reconnecting
  // and basic background task updates if the user quickly checks back
  private readonly DISCONNECT_DELAY = 60000 

  /**
   * Connect to a session or reuse existing connection
   * @param sessionId The session ID to connect to
   * @param handlers Event handlers for this subscription
   * @returns A cleanup function to unsubscribe
   */
  connect(sessionId: string, handlers: WSHandlers): () => void {
    // 1. Cancel any pending disconnect timer
    if (this.disconnectTimers.has(sessionId)) {
      clearTimeout(this.disconnectTimers.get(sessionId)!)
      this.disconnectTimers.delete(sessionId)
    }

    // 2. Add subscriber
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set())
    }
    this.subscribers.get(sessionId)!.add(handlers)

    // 3. Ensure WebSocket is open
    const ws = this.sockets.get(sessionId)
    
    // If socket doesn't exist or is closed/closing, create a new one
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      this.createConnection(sessionId)
    } else if (ws.readyState === WebSocket.OPEN) {
      // If already open, trigger onOpen immediately for this new subscriber
      handlers.onOpen?.()
    }

    // 4. Return unsubscribe function
    return () => this.disconnect(sessionId, handlers)
  }

  private createConnection(sessionId: string) {
    const ws = createSocket({
      onOpen: () => {
        this.broadcast(sessionId, 'onOpen')
      },
      onMessage: (data: WSEvent) => {
        this.broadcast(sessionId, 'onMessage', data)
      },
      onError: (err: Event) => {
        this.broadcast(sessionId, 'onError', err)
      },
      onClose: () => {
        this.broadcast(sessionId, 'onClose')
        // Clean up if closed from server side
        if (this.sockets.get(sessionId) === ws) {
          this.sockets.delete(sessionId)
        }
      }
    }, { sessionId })

    this.sockets.set(sessionId, ws)
  }

  private disconnect(sessionId: string, handlers: WSHandlers) {
    const subs = this.subscribers.get(sessionId)
    if (subs) {
      subs.delete(handlers)
      
      // If no more subscribers, schedule disconnect
      if (subs.size === 0) {
        this.disconnectTimers.set(sessionId, setTimeout(() => {
           const ws = this.sockets.get(sessionId)
           if (ws) {
             ws.close()
             this.sockets.delete(sessionId)
           }
           this.disconnectTimers.delete(sessionId)
           this.subscribers.delete(sessionId)
        }, this.DISCONNECT_DELAY))
      }
    }
  }

  private broadcast(sessionId: string, method: keyof WSHandlers, data?: any) {
    const subs = this.subscribers.get(sessionId)
    if (subs) {
      // Create a copy to avoid issues if handlers unsubscribe during execution
      const handlers = Array.from(subs)
      handlers.forEach(h => {
          if (h[method]) {
              try {
                // @ts-ignore - Dynamic dispatch
                h[method](data)
              } catch (e) {
                console.error(`Error in ${method} handler for session ${sessionId}:`, e)
              }
          }
      })
    }
  }

  /**
   * Manually close a connection if needed
   */
  close(sessionId: string) {
    const ws = this.sockets.get(sessionId)
    if (ws) {
      ws.close()
      this.sockets.delete(sessionId)
    }
    if (this.disconnectTimers.has(sessionId)) {
      clearTimeout(this.disconnectTimers.get(sessionId)!)
      this.disconnectTimers.delete(sessionId)
    }
    this.subscribers.delete(sessionId)
  }

  /**
   * Send a message to the session
   */
  send(sessionId: string, data: any) {
    const ws = this.sockets.get(sessionId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data))
    } else {
      console.warn(`Cannot send message: Session ${sessionId} not connected or ready`)
    }
  }
}

export const connectionManager = new ConnectionManager()
