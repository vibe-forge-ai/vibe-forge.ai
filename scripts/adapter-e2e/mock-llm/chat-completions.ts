import { randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'

import type { MockToolCall } from '../types'
import { writeJson, writeSseEvent } from './http'
import { buildResponsesToolCall } from './responses'

export const writeChatCompletionResult = (
  res: ServerResponse,
  payload: {
    model: string
    text?: string
    tool?: MockToolCall
    stream?: boolean
  }
) => {
  const toolCall = payload.tool == null ? undefined : buildResponsesToolCall(payload.tool)
  const response = {
    id: `chatcmpl_${randomUUID().replace(/-/g, '')}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: payload.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: toolCall == null ? payload.text ?? null : null,
          ...(toolCall == null
            ? {}
            : {
              tool_calls: [
                {
                  id: toolCall.call_id,
                  type: 'function',
                  function: {
                    name: toolCall.name,
                    arguments: toolCall.arguments
                  }
                }
              ]
            })
        },
        finish_reason: toolCall == null ? 'stop' : 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  }

  if (payload.stream !== true) {
    writeJson(res, 200, response)
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive'
  })

  if (toolCall != null) {
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: payload.model,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: toolCall.call_id,
                type: 'function',
                function: {
                  name: toolCall.name,
                  arguments: toolCall.arguments
                }
              }
            ]
          },
          finish_reason: null
        }
      ]
    })
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: payload.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'tool_calls'
        }
      ]
    })
  } else {
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: payload.model,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: payload.text ?? ''
          },
          finish_reason: null
        }
      ]
    })
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: payload.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    })
  }

  res.write('data: [DONE]\n\n')
  res.end()
}
