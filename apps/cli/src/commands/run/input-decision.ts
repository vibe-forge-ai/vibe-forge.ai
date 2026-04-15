import type { Buffer } from 'node:buffer'
import { createInterface } from 'node:readline'

import { parseCliInputControlEvent } from './input-control'
import type { RunInputFormat } from './types'

const resolveDecisionFromPayload = (payload: unknown) => {
  const event = parseCliInputControlEvent(payload)
  if (event.type === 'submit_input') {
    return event.data
  }
  if (event.type === 'message' && typeof event.content === 'string' && event.content.trim() !== '') {
    return event.content.trim()
  }
  throw new TypeError('Permission recovery expects submit_input or a plain text decision like allow_once.')
}

const readFirstLine = async (stdin: NodeJS.ReadStream) =>
  await new Promise<string>((resolve, reject) => {
    const rl = createInterface({ input: stdin, crlfDelay: Infinity })
    let settled = false
    const cleanup = () => {
      stdin.off('error', onError)
      rl.close()
    }
    const onError = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (trimmed === '') return
      settled = true
      cleanup()
      resolve(trimmed)
    })
    rl.once('close', () => {
      if (settled) return
      settled = true
      reject(new TypeError('Permission recovery input closed before any decision was provided.'))
    })
    stdin.once('error', onError)
  })

const readAll = async (stdin: NodeJS.ReadStream) =>
  await new Promise<string>((resolve, reject) => {
    const chunks: string[] = []
    const onData = (chunk: string | Buffer) => {
      chunks.push(String(chunk))
    }
    const onEnd = () => {
      cleanup()
      resolve(chunks.join(''))
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      stdin.off('data', onData)
      stdin.off('end', onEnd)
      stdin.off('error', onError)
    }
    stdin.on('data', onData)
    stdin.once('end', onEnd)
    stdin.once('error', onError)
  })

export const readCliPermissionDecision = async (params: {
  format: RunInputFormat
  stdin: NodeJS.ReadStream
}) => {
  params.stdin.setEncoding('utf8')
  if (params.format === 'stream-json') {
    return resolveDecisionFromPayload(JSON.parse(await readFirstLine(params.stdin)))
  }
  if (params.format === 'json') {
    return resolveDecisionFromPayload(JSON.parse((await readAll(params.stdin)).trim()))
  }

  return resolveDecisionFromPayload(await readFirstLine(params.stdin))
}
