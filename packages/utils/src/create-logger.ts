import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { LogLevel, Logger } from '@vibe-forge/types'

export type { Logger } from '@vibe-forge/types'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

export const createLogger = (
  cwd: string,
  taskId: string,
  sessionId: string,
  logPrefix = '',
  level: LogLevel = 'info'
): Logger => {
  const normalizedSessionId = sessionId ?? 'default'
  const taskDir = resolve(
    cwd,
    `.ai${logPrefix}/logs/${taskId}`
  )

  const loggerFilePath = resolve(
    taskDir,
    `${normalizedSessionId}.log.md`
  )
  // 默认日志文件不存在时，创建一个默认的日志文件
  if (!existsSync(loggerFilePath)) {
    mkdirSync(dirname(loggerFilePath), { recursive: true })
  }
  const loggerStream = createWriteStream(loggerFilePath, {
    flags: 'a'
  })
  const createLog = (tag: string, currentLevel: LogLevel) => (...args: unknown[]) => {
    if (LOG_LEVEL_PRIORITY[currentLevel] < LOG_LEVEL_PRIORITY[level]) {
      return
    }
    const msg = args
      .map((arg) => {
        if (typeof arg === 'string') {
          return arg
        }
        if (arg instanceof Error) {
          return (
            '\n```text\n' +
            `${arg.stack}\n` +
            '```'
          )
        }
        return (
          '\n```json\n' +
          `${JSON.stringify(arg, null, 2)}\n` +
          '```'
        )
      })
      .join(' ')
    const now = new Date().toLocaleString()
    if (loggerStream.writableEnded) {
      const tempLoggerStream = createWriteStream(loggerFilePath, {
        flags: 'a'
      })
      tempLoggerStream.write(
        `# [${now}] __E__ UNEXPECTED LOGGER STREAM ENDED\n`
      )
      tempLoggerStream.write(`# [${now}] __${tag}__ ${msg}\n`)
      tempLoggerStream.end()
      return
    }
    loggerStream.write(`# [${now}] __${tag}__ ${msg}\n`)
  }
  return {
    stream: loggerStream,
    info: createLog('I', 'info'),
    warn: createLog('W', 'warn'),
    debug: createLog('D', 'debug'),
    error: createLog('E', 'error')
  }
}
