export interface Logger {
  stream: NodeJS.WritableStream
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}
