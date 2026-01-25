import fs from 'node:fs'
import path from 'node:path'
import { cwd as processCwd } from 'node:process'

import pino from 'pino'

import { loadEnv } from '@vibe-forge/core'

const env = loadEnv()
const LOG_DIR = path.isAbsolute(env.LOG_DIR)
  ? env.LOG_DIR
  : path.join(processCwd(), env.LOG_DIR)

// Ensure base log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

/**
 * Get a logger instance for a specific session and log type
 */
export function getSessionLogger(sessionId: string, type: 'server' | 'claude.cli.spawn') {
  const sessionDir = path.join(LOG_DIR, sessionId)

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const logFile = path.join(sessionDir, `${type}.log.jsonl`)

  return pino(
    {
      level: env.LOG_LEVEL,
      base: null, // Remove default pid and hostname for cleaner jsonl
      timestamp: pino.stdTimeFunctions.isoTime
    },
    pino.destination({
      dest: logFile,
      sync: true // 使用同步写入确保实时性，且避免丢失
    })
  )
}

// Default global logger for general server logs (not session-specific)
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})
