import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import { resolveCliSession, writeCliSessionControl, writeCliSessionRecord } from '#~/session-cache.js'

const STOP_SIGNAL_TIMEOUT_MS = {
  SIGTERM: 10_000,
  SIGKILL: 2_000
} as const

const isProcessAlive = (
  pid: number,
  sendSignal: (pid: number, signal?: NodeJS.Signals | number) => void
) => {
  try {
    sendSignal(pid, 0)
    return true
  } catch (error: any) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

export const waitForProcessExit = async (params: {
  pid: number
  timeoutMs: number
  sendSignal?: (pid: number, signal?: NodeJS.Signals | number) => void
}) => {
  const sendSignal = params.sendSignal ?? process.kill
  const deadline = Date.now() + params.timeoutMs

  while (Date.now() < deadline) {
    if (!isProcessAlive(params.pid, sendSignal)) return true
    await delay(100)
  }

  return !isProcessAlive(params.pid, sendSignal)
}

export const signalCliSession = async (params: {
  cwd: string
  sessionId: string
  signal: 'SIGTERM' | 'SIGKILL'
  sendSignal?: (pid: number, signal?: NodeJS.Signals | number) => void
  waitForExit?: typeof waitForProcessExit
  now?: () => number
}) => {
  const sendSignal = params.sendSignal ?? process.kill
  const waitForExit = params.waitForExit ?? waitForProcessExit
  const now = params.now ?? Date.now

  const record = await resolveCliSession(params.cwd, params.sessionId)
  const detail = record.detail
  if (detail == null) {
    throw new Error(`Session ${params.sessionId} has no task metadata.`)
  }

  if (detail.status !== 'running') {
    return {
      message: `Session ${detail.sessionId} is not running (status: ${detail.status}).`
    }
  }

  if (detail.pid == null) {
    throw new Error(`Session ${detail.sessionId} has no PID recorded.`)
  }

  try {
    sendSignal(detail.pid, params.signal)
  } catch (error: any) {
    if (error.code === 'ESRCH') {
      throw new Error(`Process ${detail.pid} not found.`)
    }
    throw new Error(`Failed to signal process ${detail.pid}: ${error.message}`)
  }

  const requestedAt = now()
  const timeoutMs = STOP_SIGNAL_TIMEOUT_MS[params.signal]
  await writeCliSessionControl(params.cwd, detail.ctxId, detail.sessionId, {
    signal: params.signal,
    requestedAt,
    expiresAt: requestedAt + timeoutMs
  })

  const didExit = await waitForExit({
    pid: detail.pid,
    timeoutMs,
    sendSignal
  })

  if (didExit) {
    await writeCliSessionRecord(params.cwd, detail.ctxId, detail.sessionId, {
      ...record,
      detail: {
        ...detail,
        status: 'stopped',
        endTime: now()
      }
    })

    return {
      message: `Sent ${params.signal} to process ${detail.pid} for session ${detail.sessionId}.`
    }
  }

  return {
    message:
      `Sent ${params.signal} to process ${detail.pid} for session ${detail.sessionId}. Waiting for the session to exit.`
  }
}
