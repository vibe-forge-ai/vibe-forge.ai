import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'

import { afterEach, describe, expect, it } from 'vitest'

import {
  convertGeminiRequestToOpenAiRequest,
  convertOpenAiResponseToGeminiResponse,
  ensureGeminiProxyRoute,
  sanitizeGeminiSchemaForOpenAi
} from '#~/runtime/proxy.js'

const upstreamServers: Server[] = []

const closeServer = async (server: Server) => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error != null) reject(error)
      else resolve()
    })
  })
}

const readRequestBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

afterEach(async () => {
  await Promise.all(upstreamServers.splice(0).map(closeServer))
})

describe('gemini proxy conversions', () => {
  it('maps Gemini generateContent payloads to OpenAI chat completions', () => {
    expect(convertGeminiRequestToOpenAiRequest({
      disableThinking: true,
      model: 'kimi-k2.5',
      maxOutputTokens: 2048,
      request: {
        systemInstruction: {
          parts: [{ text: 'system rule' }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: 'first user message' }]
          },
          {
            role: 'model',
            parts: [{
              functionCall: {
                name: 'ReadFile',
                args: {
                  path: '/tmp/README.md'
                }
              }
            }]
          },
          {
            role: 'user',
            parts: [{
              functionResponse: {
                name: 'ReadFile',
                response: {
                  text: 'file content'
                }
              }
            }]
          }
        ],
        tools: [{
          functionDeclarations: [{
            name: 'ReadFile',
            description: 'Read a file',
            parameters: {
              type: 'OBJECT',
              properties: {
                path: {
                  type: 'STRING',
                  propertyOrdering: ['ignored']
                }
              },
              required: ['path']
            }
          }]
        }]
      }
    })).toMatchObject({
      model: 'kimi-k2.5',
      stream: false,
      thinking: {
        type: 'disabled'
      },
      max_tokens: 2048,
      messages: [
        { role: 'system', content: 'system rule' },
        { role: 'user', content: 'first user message' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            type: 'function',
            function: {
              name: 'ReadFile',
              arguments: '{"path":"/tmp/README.md"}'
            }
          }]
        },
        {
          role: 'tool',
          content: '{"text":"file content"}'
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'ReadFile',
          description: 'Read a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string'
              }
            },
            required: ['path']
          }
        }
      }]
    })
  })

  it('maps OpenAI chat completions back to Gemini response chunks', () => {
    expect(convertOpenAiResponseToGeminiResponse({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: 'Need a file first.',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: {
              name: 'ReadFile',
              arguments: '{"path":"/tmp/README.md"}'
            }
          }]
        }
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    })).toEqual({
      candidates: [{
        index: 0,
        content: {
          role: 'model',
          parts: [
            { text: 'Need a file first.' },
            {
              functionCall: {
                name: 'ReadFile',
                args: {
                  path: '/tmp/README.md'
                }
              }
            }
          ]
        },
        finishReason: 'STOP'
      }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15
      }
    })
  })

  it('normalizes Gemini schemas to OpenAI-compatible JSON schema', () => {
    expect(sanitizeGeminiSchemaForOpenAi({
      type: ['STRING', 'NULL'],
      nullable: true,
      propertyOrdering: ['ignored'],
      items: {
        type: 'INTEGER'
      }
    })).toEqual({
      anyOf: [
        { type: 'string' },
        { type: 'null' }
      ],
      items: {
        type: 'integer'
      }
    })
  })
})

describe('gemini proxy server', () => {
  it('serves Gemini SSE responses from an OpenAI-compatible upstream', async () => {
    let capturedRequest:
      | {
        authorization: string | undefined
        body: Record<string, unknown>
        url: string | undefined
      }
      | undefined

    const upstream = createServer(async (req, res) => {
      capturedRequest = {
        authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
        body: JSON.parse(await readRequestBody(req)) as Record<string, unknown>,
        url: req.url
      }

      res.writeHead(200, {
        'Content-Type': 'application/json'
      })
      res.end(JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: {
            content: 'KIMI_PROXY_OK'
          }
        }],
        usage: {
          prompt_tokens: 3,
          completion_tokens: 2,
          total_tokens: 5
        }
      }))
    })
    upstreamServers.push(upstream)

    await new Promise<void>((resolve, reject) => {
      upstream.once('error', reject)
      upstream.listen(0, '127.0.0.1', () => {
        upstream.off('error', reject)
        resolve()
      })
    })

    const address = upstream.address()
    if (address == null || typeof address === 'string') {
      throw new Error('Failed to resolve upstream address')
    }

    const route = await ensureGeminiProxyRoute({
      apiKey: 'kimi-secret',
      endpoint: `http://127.0.0.1:${address.port}/v1/chat/completions`,
      model: 'kimi-k2.5',
      queryParams: {
        source: 'vf'
      },
      serviceKey: 'kimi'
    })

    const response = await fetch(`${route.baseUrl}/v1beta/models/kimi-k2.5:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: 'Reply with exactly KIMI_PROXY_OK.'
          }]
        }]
      })
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain(
      'data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"KIMI_PROXY_OK"}]}'
    )
    expect(capturedRequest).toMatchObject({
      authorization: 'Bearer kimi-secret',
      url: '/v1/chat/completions?source=vf',
      body: {
        model: 'kimi-k2.5',
        stream: false,
        messages: [{
          role: 'user',
          content: 'Reply with exactly KIMI_PROXY_OK.'
        }]
      }
    })
  })
})
