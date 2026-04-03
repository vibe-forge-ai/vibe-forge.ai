import process from 'node:process'

import type { ExitControllableSession } from './types'

export const createSessionExitController = <T extends ExitControllableSession>(params?: {
  exit?: (code: number) => never | void
}) => {
  let session: T | undefined
  let pendingExitCode: number | undefined
  let didRequestExit = false
  let didExit = false
  const exit = params?.exit ?? process.exit

  const signalSessionExit = (target: T) => {
    if (pendingExitCode === 0 && typeof target.stop === 'function') {
      target.stop()
      return
    }
    target.kill()
  }

  return {
    bindSession(nextSession: T) {
      session = nextSession
      if (pendingExitCode == null) return
      signalSessionExit(session)
    },
    requestExit(code: number) {
      if (didRequestExit) return
      didRequestExit = true
      pendingExitCode = code
      if (session != null) {
        signalSessionExit(session)
      }
    },
    handleSessionExit(code: number) {
      if (didExit) return
      didExit = true
      exit(pendingExitCode ?? code)
    },
    getPendingExitCode() {
      return pendingExitCode
    }
  }
}
