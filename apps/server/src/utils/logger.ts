import fs from 'node:fs'
import path from 'node:path'
import { cwd as processCwd } from 'node:process'

import pino from 'pino'

import { loadEnv } from '@vibe-forge/core'

const env = loadEnv()
const __VF_PROJECT_AI_SERVER_LOG_DIR__ = path.isAbsolute(env.__VF_PROJECT_AI_SERVER_LOG_DIR__)
  ? env.__VF_PROJECT_AI_SERVER_LOG_DIR__
  : path.join(processCwd(), env.__VF_PROJECT_AI_SERVER_LOG_DIR__)

// Ensure base log directory exists
if (!fs.existsSync(__VF_PROJECT_AI_SERVER_LOG_DIR__)) {
  fs.mkdirSync(__VF_PROJECT_AI_SERVER_LOG_DIR__, { recursive: true })
}

/**
 * Get a logger instance for a specific session and log type
 */
export function getSessionLogger(sessionId: string, type: 'server' | 'claude.cli.spawn') {
  const sessionDir = path.join(__VF_PROJECT_AI_SERVER_LOG_DIR__, sessionId)

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const logFile = path.join(sessionDir, `${type}.log.jsonl`)

  return pino(
    {
      level: env.__VF_PROJECT_AI_SERVER_LOG_LEVEL__,
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
  level: env.__VF_PROJECT_AI_SERVER_LOG_LEVEL__,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})
