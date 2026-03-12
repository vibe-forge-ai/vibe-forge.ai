const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const writeDebugLog = (message, data = null) => {
  const timestamp = new Date().toISOString()
  try {
    const logMessage = data
      ? `# [${timestamp}] ${message}:\n` +
        '```json\n' +
        `${JSON.stringify(data, null, 2)}\n` +
        '```\n'
      : `# [${timestamp}] ${message}\n`
    const logPath = path.join(
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
      '.ai',
      'logs',
      process.env.__VF_PROJECT_AI_CTX_ID__,
      process.env.__VF_PROJECT_AI_SESSION_ID__,
      'adapter-claude-code',
      'openai-polyfill.js.log.md'
    )
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true })
    }

    fs.appendFileSync(logPath, logMessage)
  } catch (error) {
    fs.appendFileSync(
      path.join(__dirname, 'temp.log.md'),
      `# [${timestamp}] ${error}\n`
    )
    // 静默处理写入错误，避免影响正常流程
  }
}

writeDebugLog('load openai-polyfill', process.env)

class OpenAIResponsesTransformer {
  name = 'openai-responses'
  transformRequestIn(request) {
    writeDebugLog('OpenAIResponsesTransformer transformRequestIn', request)
    delete request.temperature
    delete request.max_tokens

    // 处理 reasoning 参数
    if (request.reasoning) {
      request.reasoning = {
        effort: request.reasoning.effort,
        summary: 'detailed'
      }
    }

    const input = []

    const systemMessages = request.messages.filter(
      (msg) => msg.role === 'system'
    )
    if (systemMessages.length > 0) {
      const firstSystem = systemMessages[0]
      if (Array.isArray(firstSystem.content)) {
        firstSystem.content.forEach((item) => {
          let text = ''
          if (typeof item === 'string') {
            text = item
          } else if (item && typeof item === 'object' && 'text' in item) {
            text = item.text
          }
          input.push({
            role: 'system',
            content: text
          })
        })
      } else {
        request.instructions = firstSystem.content
      }
    }

    request.messages.forEach((message) => {
      if (message.role === 'system') {
        return
      }

      let parsedContentObj = message.content
      try {
        if (message.role === 'tool' && typeof message.content === 'string') {
          parsedContentObj = JSON.parse(message.content)
        }
      } catch (error) {
        // 忽略解析错误，保持原始内容
      }

      if (Array.isArray(parsedContentObj)) {
        const convertedContent = parsedContentObj
          .map((content) => this.normalizeRequestContent(content, message.role))
          .filter((content) => content !== null)

        if (convertedContent.length > 0) {
          message.content = convertedContent
        } else {
          delete message.content
        }
      }

      if (message.role === 'tool') {
        const toolMessage = { ...message }
        toolMessage.type = 'function_call_output'
        toolMessage.call_id = message.tool_call_id
        toolMessage.output = message.content
        delete toolMessage.cache_control
        delete toolMessage.role
        delete toolMessage.tool_call_id
        delete toolMessage.content
        input.push(toolMessage)
        return
      }

      if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
        message.tool_calls.forEach((tool) => {
          input.push({
            type: 'function_call',
            arguments: tool.function.arguments,
            name: tool.function.name,
            call_id: tool.id
          })
        })
        return
      }

      input.push(message)
    })

    writeDebugLog(
      'OpenAIResponsesTransformer transformRequestIn resolved input',
      input
    )
    request.input = input
    delete request.messages

    if (Array.isArray(request.tools)) {
      const webSearch = request.tools.find(
        (tool) => tool.function.name === 'web_search'
      )

      request.tools = request.tools
        .filter((tool) => tool.function.name !== 'web_search')
        .map((tool) => {
          if (tool.function.name === 'WebSearch') {
            delete tool.function.parameters.properties.allowed_domains
          }
          if (tool.function.name === 'Edit') {
            return {
              type: tool.type,
              name: tool.function.name,
              description: tool.function.description,
              parameters: {
                ...tool.function.parameters,
                required: [
                  'file_path',
                  'old_string',
                  'new_string',
                  'replace_all'
                ]
              },
              strict: true
            }
          }
          return {
            type: tool.type,
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters
          }
        })

      if (webSearch) {
        request.tools.push({
          type: 'web_search'
        })
      }
    }

    request.parallel_tool_calls = false

    return request
  }

  async transformResponseOut(response) {
    const contentType = response.headers.get('Content-Type') || ''

    if (contentType.includes('application/json')) {
      const jsonResponse = await response.json()
      writeDebugLog(
        'OpenAIResponsesTransformer transformResponseOut application/json',
        jsonResponse
      )

      // 检查是否为responses API格式的JSON响应
      if (jsonResponse.object === 'response' && jsonResponse.output) {
        // 将responses格式转换为chat格式
        const chatResponse = this.convertResponseToChat(jsonResponse)
        return new Response(JSON.stringify(chatResponse), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        })
      }

      // 不是responses API格式，保持原样
      return new Response(JSON.stringify(jsonResponse), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    } else if (contentType.includes('text/event-stream')) {
      if (!response.body) {
        return response
      }

      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let buffer = '' // 用于缓冲不完整的数据
      let isStreamEnded = false

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader()

          // 索引跟踪变量，只有在事件类型切换时才增加索引
          let currentIndex = -1
          let lastEventType = ''

          // 获取当前应该使用的索引的函数
          const getCurrentIndex = (eventType) => {
            if (eventType !== lastEventType) {
              currentIndex++
              lastEventType = eventType
            }
            return currentIndex
          }

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                if (!isStreamEnded) {
                  // 发送结束标记
                  const doneChunk = 'data: [DONE]\n\n'
                  controller.enqueue(encoder.encode(doneChunk))
                }
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk

              // 处理缓冲区中完整的数据行
              const lines = buffer.split(/\r?\n/)
              buffer = lines.pop() || '' // 最后一行可能不完整，保留在缓冲区

              for (const line of lines) {
                if (!line.trim()) {
                  continue
                }

                try {
                  if (line.startsWith('event: ')) {
                    // 处理事件行，暂存以便与下一行数据配对
                    continue
                  } else if (line.startsWith('data: ')) {
                    const dataStr = line.slice(5).trim() // 移除 "data: " 前缀
                    if (dataStr === '[DONE]') {
                      isStreamEnded = true
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                      continue
                    }

                    try {
                      const data = JSON.parse(dataStr)

                      // 根据不同的事件类型转换为chat格式
                      if (data.type === 'response.output_text.delta') {
                        // 将output_text.delta转换为chat格式
                        const chatChunk = {
                          id: data.item_id || `chatcmpl-${Date.now()}`,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: data.response?.model,
                          choices: [
                            {
                              index: getCurrentIndex(data.type),
                              delta: {
                                content: data.delta || ''
                              },
                              finish_reason: null
                            }
                          ]
                        }

                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify(chatChunk)}\n\n`
                          )
                        )
                      } else if (
                        data.type === 'response.output_item.added' &&
                        data.item?.type === 'function_call'
                      ) {
                        // 处理function call开始 - 创建初始的tool call chunk
                        const functionCallChunk = {
                          id: data.item.call_id ||
                            data.item.id ||
                            `chatcmpl-${Date.now()}`,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: data.response?.model || 'gpt-5-codex-',
                          choices: [
                            {
                              index: getCurrentIndex(data.type),
                              delta: {
                                role: 'assistant',
                                tool_calls: [
                                  {
                                    index: 0,
                                    id: data.item.call_id || data.item.id,
                                    function: {
                                      name: data.item.name || '',
                                      arguments: ''
                                    },
                                    type: 'function'
                                  }
                                ]
                              },
                              finish_reason: null
                            }
                          ]
                        }

                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify(functionCallChunk)}\n\n`
                          )
                        )
                      } else if (
                        data.type === 'response.output_item.added' &&
                        data.item?.type === 'message'
                      ) {
                        // 处理message item added事件
                        const contentItems = []
                        ;(data.item.content || []).forEach((item) => {
                          if (item.type === 'output_text') {
                            contentItems.push({
                              type: 'text',
                              text: item.text || ''
                            })
                          }
                        })

                        const delta = { role: 'assistant' }
                        if (
                          contentItems.length === 1 &&
                          contentItems[0].type === 'text'
                        ) {
                          delta.content = contentItems[0].text
                        } else if (contentItems.length > 0) {
                          delta.content = contentItems
                        }
                        if (delta.content) {
                          const messageChunk = {
                            id: data.item.id || `chatcmpl-${Date.now()}`,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: data.response?.model,
                            choices: [
                              {
                                index: getCurrentIndex(data.type),
                                delta,
                                finish_reason: null
                              }
                            ]
                          }

                          controller.enqueue(
                            encoder.encode(
                              `data: ${JSON.stringify(messageChunk)}\n\n`
                            )
                          )
                        }
                      } else if (
                        data.type === 'response.output_text.annotation.added'
                      ) {
                        const annotationChunk = {
                          id: data.item_id || `chatcmpl-${Date.now()}`,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: data.response?.model || 'gpt-5-codex',
                          choices: [
                            {
                              index: getCurrentIndex(data.type),
                              delta: {
                                annotations: [
                                  {
                                    type: 'url_citation',
                                    url_citation: {
                                      url: data.annotation?.url || '',
                                      title: data.annotation?.title || '',
                                      content: '',
                                      start_index: data.annotation?.start_index || 0,
                                      end_index: data.annotation?.end_index || 0
                                    }
                                  }
                                ]
                              },
                              finish_reason: null
                            }
                          ]
                        }

                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify(annotationChunk)}\n\n`
                          )
                        )
                      } else if (
                        data.type === 'response.function_call_arguments.delta'
                      ) {
                        // 处理function call参数增量
                        const functionCallChunk = {
                          id: data.item_id || `chatcmpl-${Date.now()}`,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: data.response?.model || 'gpt-5-codex-',
                          choices: [
                            {
                              index: getCurrentIndex(data.type),
                              delta: {
                                tool_calls: [
                                  {
                                    index: 0,
                                    function: {
                                      arguments: data.delta || ''
                                    }
                                  }
                                ]
                              },
                              finish_reason: null
                            }
                          ]
                        }

                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify(functionCallChunk)}\n\n`
                          )
                        )
                      } else if (data.type === 'response.completed') {
                        // 发送结束标记 - 检查是否是tool_calls完成
                        const finishReason = data.response?.output?.some(
                            (item) => item.type === 'function_call'
                          )
                          ? 'tool_calls'
                          : 'stop'

                        const endChunk = {
                          id: data.response?.id || `chatcmpl-${Date.now()}`,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: data.response?.model || 'gpt-5-codex-',
                          choices: [
                            {
                              index: 0,
                              delta: {},
                              finish_reason: finishReason
                            }
                          ]
                        }

                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify(endChunk)}\n\n`
                          )
                        )
                        isStreamEnded = true
                      } else if (
                        data.type === 'response.reasoning_summary_text.delta'
                      ) {
                        // 处理推理文本，将其转换为 thinking delta 格式
                        const thinkingChunk = {
                          id: data.item_id || `chatcmpl-${Date.now()}`,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: data.response?.model,
                          choices: [
                            {
                              index: getCurrentIndex(data.type),
                              delta: {
                                thinking: {
                                  content: data.delta || ''
                                }
                              },
                              finish_reason: null
                            }
                          ]
                        }

                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify(thinkingChunk)}\n\n`
                          )
                        )
                      } else if (
                        data.type === 'response.reasoning_summary_part.done' &&
                        data.part
                      ) {
                        const thinkingChunk = {
                          id: data.item_id || `chatcmpl-${Date.now()}`,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: data.response?.model,
                          choices: [
                            {
                              index: currentIndex,
                              delta: {
                                thinking: {
                                  signature: data.item_id
                                }
                              },
                              finish_reason: null
                            }
                          ]
                        }

                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify(thinkingChunk)}\n\n`
                          )
                        )
                      }
                    } catch (e) {
                      // 如果JSON解析失败，传递原始行
                      controller.enqueue(encoder.encode(`${line}\n`))
                    }
                  } else {
                    // 传递其他行
                    controller.enqueue(encoder.encode(`${line}\n`))
                  }
                } catch (error) {
                  console.error('Error processing line:', line, error)
                  // 如果解析失败，直接传递原始行
                  controller.enqueue(encoder.encode(`${line}\n`))
                }
              }
            }

            // 处理缓冲区中剩余的数据
            if (buffer.trim()) {
              controller.enqueue(encoder.encode(`${buffer}\n`))
            }

            // 确保流结束时发送结束标记
            if (!isStreamEnded) {
              const doneChunk = 'data: [DONE]\n\n'
              controller.enqueue(encoder.encode(doneChunk))
            }
          } catch (error) {
            console.error('Stream error:', error)
            controller.error(error)
          } finally {
            try {
              reader.releaseLock()
            } catch (e) {
              console.error('Error releasing reader lock:', e)
            }
            controller.close()
          }
        }
      })

      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    return response
  }

  normalizeRequestContent(content, role) {
    // 克隆内容对象并删除缓存控制字段
    const clone = { ...content }
    delete clone.cache_control

    if (content.type === 'text') {
      return {
        type: role === 'assistant' ? 'output_text' : 'input_text',
        text: content.text
      }
    }

    if (content.type === 'image_url' || content.type === 'image') {
      const imagePayload = {
        type: role === 'assistant' ? 'output_image' : 'input_image'
      }
      if (
        content.type === 'image_url' &&
        typeof content.image_url?.url === 'string'
      ) {
        const mediaType = content.image_url?.media_type || 'image/jpeg'
        // 按照图片类型处理为下面的格式
        // "image_url": f"data:image/jpeg;base64,{base64_image}",
        imagePayload.image_url = `data:${mediaType};base64,${content.image_url.url}`
      }
      if (content.type === 'image') {
        const mediaType = content.source?.media_type || 'image/jpeg'
        // 按照图片类型处理为下面的格式
        // "image_url": f"data:image/jpeg;base64,{base64_image}",
        imagePayload.image_url = `data:${mediaType};base64,${content.source.data}`
      }

      return imagePayload
    }

    return null
  }

  convertResponseToChat(responseData) {
    // 从output数组中提取不同类型的输出
    const messageOutput = responseData.output?.find(
      (item) => item.type === 'message'
    )
    const functionCallOutput = responseData.output?.find(
      (item) => item.type === 'function_call'
    )
    let annotations
    if (
      messageOutput?.content?.length &&
      messageOutput?.content[0].annotations
    ) {
      annotations = messageOutput.content[0].annotations.map((item) => ({
        type: 'url_citation',
        url_citation: {
          url: item.url || '',
          title: item.title || '',
          content: '',
          start_index: item.start_index || 0,
          end_index: item.end_index || 0
        }
      }))
    }

    this.logger.debug({
      data: annotations,
      type: 'url_citation'
    })

    let messageContent = null
    let toolCalls = null
    let thinking = null

    // 处理推理内容
    if (messageOutput && messageOutput.reasoning) {
      thinking = {
        content: messageOutput.reasoning
      }
    }

    if (messageOutput && messageOutput.content) {
      // 分离文本和图片内容
      const textParts = []
      const imageParts = []

      messageOutput.content.forEach((item) => {
        if (item.type === 'output_text') {
          textParts.push(item.text || '')
        } else if (item.type === 'output_image') {
          const imageContent = this.buildImageContent({
            url: item.image_url,
            mime_type: item.mime_type
          })
          if (imageContent) {
            imageParts.push(imageContent)
          }
        } else if (item.type === 'output_image_base64') {
          const imageContent = this.buildImageContent({
            b64_json: item.image_base64,
            mime_type: item.mime_type
          })
          if (imageContent) {
            imageParts.push(imageContent)
          }
        }
      })

      // 构建最终内容
      if (imageParts.length > 0) {
        // 如果有图片，将所有内容组合成数组
        const contentArray = []
        if (textParts.length > 0) {
          contentArray.push({
            type: 'text',
            text: textParts.join('')
          })
        }
        contentArray.push(...imageParts)
        messageContent = contentArray
      } else {
        // 如果只有文本，返回字符串
        messageContent = textParts.join('')
      }
    }

    if (functionCallOutput) {
      // 处理function_call类型的输出
      toolCalls = [
        {
          id: functionCallOutput.call_id || functionCallOutput.id,
          function: {
            name: functionCallOutput.name,
            arguments: functionCallOutput.arguments
          },
          type: 'function'
        }
      ]
    }

    // 构建chat格式的响应
    const chatResponse = {
      id: responseData.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: responseData.created_at,
      model: responseData.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: messageContent || null,
            tool_calls: toolCalls,
            thinking,
            annotations
          },
          logprobs: null,
          finish_reason: toolCalls ? 'tool_calls' : 'stop'
        }
      ],
      usage: responseData.usage
        ? {
          prompt_tokens: responseData.usage.input_tokens || 0,
          completion_tokens: responseData.usage.output_tokens || 0,
          total_tokens: responseData.usage.total_tokens || 0
        }
        : null
    }

    return chatResponse
  }

  buildImageContent(source) {
    if (!source) {
      return null
    }

    if (source.url || source.b64_json) {
      return {
        type: 'image_url',
        image_url: {
          url: source.url || '',
          b64_json: source.b64_json
        },
        media_type: source.mime_type
      }
    }

    return null
  }
}

module.exports = OpenAIResponsesTransformer
