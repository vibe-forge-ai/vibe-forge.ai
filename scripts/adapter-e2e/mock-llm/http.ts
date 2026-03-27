import type { ServerResponse } from 'node:http'

export const writeJson = (
  res: ServerResponse,
  statusCode: number,
  payload: unknown
) => {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

export const writeSseEvent = (
  res: ServerResponse,
  event: string,
  payload: unknown
) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}
