import { Buffer } from 'node:buffer'
import type { Readable } from 'node:stream'

import { withTenantToken } from '@larksuiteoapi/node-sdk'
import type { Client } from '@larksuiteoapi/node-sdk'

import type { LarkImageDownloadResponse } from '#~/types.js'

import { isRecord } from './guards'

export const readStreamToBuffer = async (readable: Readable) => {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export const getHeaderValue = (headers: unknown, key: string) => {
  if (!isRecord(headers)) return undefined
  const lowerKey = key.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lowerKey) return typeof v === 'string' ? v : undefined
  }
  return undefined
}

export const downloadLarkImageAsDataUrl = async (
  client: Client,
  imageKey: string,
  tenantToken?: string
) => {
  const resp = await client.im.v1.image.get(
    {
      path: {
        image_key: imageKey
      }
    },
    tenantToken != null && tenantToken !== '' ? withTenantToken(tenantToken) : undefined
  ) as unknown as LarkImageDownloadResponse
  const readable = resp.getReadableStream()
  const buffer = await readStreamToBuffer(readable)
  const mimeType = getHeaderValue(resp.headers, 'content-type') ?? 'application/octet-stream'
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
  return { dataUrl, mimeType, size: buffer.length }
}
