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
    ? prev.sessions.map((currentSession) => currentSession.id === updatedSession.id ? { ...currentSession, ...session } : currentSession)
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
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      if (disposed) return

      socket = createSocket({
        onMessage: (data: WSEvent) => {
          if (data.type !== 'session_updated') return
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
          reconnectTimer = setTimeout(connect, 1000)
        },
        onError: () => {
          socket?.close()
        }
      }, { subscribe: 'sessions' })
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      socket?.close()
    }
  }, [mutate])
}
