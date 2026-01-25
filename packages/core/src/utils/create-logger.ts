import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export interface Logger {
  stream: NodeJS.WritableStream
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export const createLogger = (
  cwd: string,
  taskId: string,
  sessionId: string,
  logPrefix = ''
) => {
  const date = new Date()
  // 以 年-月-日-小时 作为一级目录名
  const dateDir = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`

  const loggerFilePath = resolve(
    cwd,
    `.ai${logPrefix}/logs/${taskId}/${dateDir}/${sessionId ?? 'default'}.log.md`
  )
  // 默认日志文件不存在时，创建一个默认的日志文件
  if (!existsSync(loggerFilePath)) {
    mkdirSync(dirname(loggerFilePath), { recursive: true })
  }
  const loggerStream = createWriteStream(loggerFilePath, {
    flags: 'a'
  })
  const createLog = (tag: string) => (...args: unknown[]) => {
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
    info: createLog('I'),
    warn: createLog('W'),
    debug: createLog('D'),
    error: createLog('E')
  }
}
