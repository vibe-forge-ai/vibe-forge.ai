import { randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'

import type { MockToolCall } from '../types'
import { writeJson, writeSseEvent } from './http'

export const buildResponsesToolCall = (tool: MockToolCall) => {
  const callId = `call_${randomUUID().replace(/-/g, '')}`
  return {
    id: callId,
    type: 'function_call',
    status: 'completed',
    call_id: callId,
    name: tool.name,
    arguments: JSON.stringify(tool.args)
  }
}

const buildResponsesMessage = (text: string) => ({
  id: `msg_${randomUUID().replace(/-/g, '')}`,
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

const buildResponseObject = (model: string, output: unknown[]) => ({
  id: `resp_${randomUUID().replace(/-/g, '')}`,
  object: 'response',
  created_at: Math.floor(Date.now() / 1000),
  model,
  output,
  parallel_tool_calls: false,
  usage: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0
  }
})

export const writeResponsesResult = (
  res: ServerResponse,
  payload: {
    model: string
    text?: string
    tool?: MockToolCall
    stream?: boolean
  }
) => {
  const output = payload.tool != null
    ? [buildResponsesToolCall(payload.tool)]
    : [buildResponsesMessage(payload.text ?? '')]
  const response = buildResponseObject(payload.model, output)

  if (payload.stream !== true) {
    writeJson(res, 200, response)
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive'
  })

  writeSseEvent(res, 'response.created', {
    type: 'response.created',
    response: {
      id: response.id,
      model: response.model,
      output: []
    }
  })

  if (payload.tool != null) {
    const toolCall = output[0] as ReturnType<typeof buildResponsesToolCall>
    writeSseEvent(res, 'response.output_item.added', {
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        ...toolCall,
        status: 'in_progress',
        arguments: ''
      },
      response: {
        id: response.id,
        model: response.model
      }
    })
    writeSseEvent(res, 'response.function_call_arguments.delta', {
      type: 'response.function_call_arguments.delta',
      item_id: toolCall.id,
      output_index: 0,
      delta: toolCall.arguments,
      response: {
        id: response.id,
        model: response.model
      }
    })
    writeSseEvent(res, 'response.function_call_arguments.done', {
      type: 'response.function_call_arguments.done',
      item_id: toolCall.id,
      output_index: 0,
      arguments: toolCall.arguments,
      response: {
        id: response.id,
        model: response.model
      }
    })
    writeSseEvent(res, 'response.output_item.done', {
      type: 'response.output_item.done',
      output_index: 0,
      item: toolCall,
      response: {
        id: response.id,
        model: response.model
      }
    })
  } else {
    const message = output[0] as ReturnType<typeof buildResponsesMessage>
    writeSseEvent(res, 'response.output_item.added', {
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        ...message,
        status: 'in_progress',
        content: [{ type: 'output_text', text: '' }]
      },
      response: {
        id: response.id,
        model: response.model
      }
    })
    writeSseEvent(res, 'response.output_text.delta', {
      type: 'response.output_text.delta',
      item_id: message.id,
      output_index: 0,
      content_index: 0,
      delta: payload.text ?? '',
      response: {
        id: response.id,
        model: response.model
      }
    })
    writeSseEvent(res, 'response.output_text.done', {
      type: 'response.output_text.done',
      item_id: message.id,
      output_index: 0,
      content_index: 0,
      text: payload.text ?? '',
      response: {
        id: response.id,
        model: response.model
      }
    })
    writeSseEvent(res, 'response.output_item.done', {
      type: 'response.output_item.done',
      output_index: 0,
      item: message,
      response: {
        id: response.id,
        model: response.model
      }
    })
  }

  writeSseEvent(res, 'response.completed', {
    type: 'response.completed',
    response
  })
  res.end()
}
