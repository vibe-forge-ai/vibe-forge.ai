import { useEffect } from 'react'
import { useSWRConfig } from 'swr'

import type { Session, WSEvent } from '@vibe-forge/core'

import { createSocket } from '#~/ws.js'

interface SessionListResponse {
  sessions: Session[]
}
interface DeletedSessionUpdate {
  id: string
  isDeleted: boolean
}
type SessionUpdate = Session | DeletedSessionUpdate

const isDeletedSessionUpdate = (update: SessionUpdate): update is DeletedSessionUpdate => {
  return 'isDeleted' in update && update.isDeleted
}

const sortSessions = (sessions: Session[]) => {
  return [...sessions].sort((a, b) => {
    const starredDelta = Number(b.isStarred === true) - Number(a.isStarred === true)
    if (starredDelta !== 0) return starredDelta
    return (b.createdAt ?? 0) - (a.createdAt ?? 0)
  })
}

const mergeSessionList = (
  prev: SessionListResponse | undefined,
  updatedSession: SessionUpdate,
  filter: 'active' | 'archived'
) => {
  if (prev?.sessions == null) return prev

  if (isDeletedSessionUpdate(updatedSession)) {
    return {
      ...prev,
      sessions: prev.sessions.filter((session) => session.id !== updatedSession.id)
    }
  }

  const session = updatedSession
  const shouldInclude = filter === 'archived'
    ? session.isArchived === true
    : session.isArchived !== true
  const existing = prev.sessions.find((session) => session.id === updatedSession.id)

  if (!shouldInclude) {
    return {
      ...prev,
      sessions: prev.sessions.filter((session) => session.id !== updatedSession.id)
    }
  }

  const nextSessions = existing
    ? prev.sessions.map((currentSession) =>
      currentSession.id === updatedSession.id ? { ...currentSession, ...session } : currentSession
    )
    : [session, ...prev.sessions]

  return {
    ...prev,
    sessions: sortSessions(nextSessions)
  }
}

export function useSessionSubscription() {
  const { mutate } = useSWRConfig()

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | undefined
    let connectTimer: ReturnType<typeof setTimeout> | undefined

    const closeSocket = (target: WebSocket | undefined) => {
      if (!target) return
      if (target.readyState === WebSocket.CLOSED || target.readyState === WebSocket.CLOSING) {
        return
      }
      if (target.readyState === WebSocket.CONNECTING) {
        target.addEventListener('open', () => target.close(), { once: true })
        return
      }
      target.close()
    }

    const scheduleConnect = (delay = 0) => {
      if (disposed) return
      if (connectTimer) {
        clearTimeout(connectTimer)
      }
      connectTimer = setTimeout(() => {
        connectTimer = undefined
        connect()
      }, delay)
    }

    const connect = () => {
      if (disposed) return

      socket = createSocket({
        onMessage: (data: WSEvent) => {
          if (disposed || data.type !== 'session_updated') return
          const updatedSession = data.session as SessionUpdate

          void mutate('/api/sessions', (prev: SessionListResponse | undefined) => {
            return mergeSessionList(prev, updatedSession, 'active')
          }, false)

          void mutate('/api/sessions/archived', (prev: SessionListResponse | undefined) => {
            return mergeSessionList(prev, updatedSession, 'archived')
          }, false)
        },
        onClose: () => {
          if (disposed) return
          scheduleConnect(1000)
        },
        onError: () => {
          closeSocket(socket)
        }
      }, { subscribe: 'sessions' })
    }

    scheduleConnect()

    return () => {
      disposed = true
      if (connectTimer) {
        clearTimeout(connectTimer)
      }
      closeSocket(socket)
    }
  }, [mutate])
}
