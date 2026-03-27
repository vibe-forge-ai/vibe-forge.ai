#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import process from 'node:process'

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? '40111')

const readJson = async (req) => {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw === '' ? {} : JSON.parse(raw)
}

const writeJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  })
  res.end(JSON.stringify(body, null, 2))
}

const writeEvent = (res, event, data) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

const buildMessageOutput = (text) => ({
  id: 'msg_mock_1',
  type: 'message',
  role: 'assistant',
  status: 'completed',
  content: [
    {
      type: 'output_text',
      text
    }
  ]
})

const buildResponse = ({
  model,
  status = 'completed',
  text = 'mock success',
  incompleteReason,
  error
}) => ({
  id: 'resp_mock_1',
  object: 'response',
  created_at: Math.floor(Date.now() / 1000),
  status,
  model,
  output: text === '' ? [] : [buildMessageOutput(text)],
  usage: {
    input_tokens: 12,
    output_tokens: text === '' ? 0 : 3,
    total_tokens: text === '' ? 12 : 15
  },
  ...(incompleteReason != null
    ? {
        incomplete_details: {
          reason: incompleteReason
        }
      }
    : {}),
  ...(error != null ? { error } : {})
})

const createErrorPayload = (status, message, code) => ({
  error: {
    message,
    type: status >= 500 ? 'server_error' : 'invalid_request_error',
    code,
    details: {
      status,
      mock: true
    }
  }
})

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    writeJson(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST' || /(?:^|\/)responses$/.test(url.pathname) === false) {
    writeJson(res, 404, { error: { message: `No mock route for ${req.method} ${url.pathname}` } })
    return
  }

  let body
  try {
    body = await readJson(req)
  } catch (error) {
    writeJson(res, 400, createErrorPayload(400, `Mock host could not parse JSON: ${String(error)}`, 'mock_bad_json'))
    return
  }

  const model = typeof body.model === 'string' ? body.model : 'unknown-model'
  const stream = body.stream === true

  process.stdout.write(`[mock-responses] ${req.method} ${url.pathname} model=${model} stream=${stream}\n`)

  if (model.includes('bad-request')) {
    writeJson(
      res,
      400,
      createErrorPayload(400, `Mock bad request for model ${model}`, 'mock_bad_request')
    )
    return
  }

  if (model.includes('server-error')) {
    writeJson(
      res,
      500,
      createErrorPayload(500, `Mock upstream failure for model ${model}`, 'mock_server_error')
    )
    return
  }

  if (model.includes('incomplete-max-output')) {
    const response = buildResponse({
      model,
      status: 'incomplete',
      text: 'partial mock output',
      incompleteReason: 'max_output_tokens'
    })

    if (stream) {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive'
      })
      writeEvent(res, 'response.created', {
        type: 'response.created',
        response: {
          ...response,
          status: 'in_progress'
        }
      })
      writeEvent(res, 'response.completed', {
        type: 'response.completed',
        response
      })
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    writeJson(res, 200, response)
    return
  }

  if (model.includes('malformed-stream')) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    })
    res.write('event: response.created\n')
    res.write('data: {"type":"response.created","response":{"id":"resp_mock_1"}}\n\n')
    res.write('event: response.completed\n')
    res.write('data: {"type":"response.completed","response":\n\n')
    res.end()
    return
  }

  const response = buildResponse({
    model,
    status: 'completed',
    text: 'mock success'
  })

  if (stream) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    })
    writeEvent(res, 'response.created', {
      type: 'response.created',
      response: {
        ...response,
        status: 'in_progress'
      }
    })
    writeEvent(res, 'response.completed', {
      type: 'response.completed',
      response
    })
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  writeJson(res, 200, response)
})

server.listen(port, host, () => {
  process.stdout.write(`[mock-responses] listening on http://${host}:${port}\n`)
})

const shutdown = () => {
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
