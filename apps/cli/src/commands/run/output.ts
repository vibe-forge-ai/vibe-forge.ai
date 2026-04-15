import type { ChatMessage } from '@vibe-forge/core'
import type { AdapterErrorData, AdapterOutputEvent, AskUserQuestionParams, TaskDetail } from '@vibe-forge/types'
import { extractTextFromMessage } from '@vibe-forge/utils/chat-message'

import type { RunOutputFormat } from './types'

export const getPrintableAssistantText = (message: ChatMessage | undefined) => {
  if (message?.role !== 'assistant') return undefined

  const text = extractTextFromMessage(message).trim()
  return text === '' ? undefined : text
}

export const resolvePrintableStopText = (
  message: ChatMessage | undefined,
  lastAssistantText: string | undefined
) => getPrintableAssistantText(message) ?? lastAssistantText

export const getAdapterErrorMessage = (data: AdapterErrorData) => {
  if (data.code === 'permission_required') {
    const details = data.details != null && typeof data.details === 'object'
      ? data.details as { permissionDenials?: Array<{ message?: string; deniedTools?: string[] }> }
      : undefined
    const deniedTools = [
      ...new Set(
        (details?.permissionDenials ?? []).flatMap(item => Array.isArray(item.deniedTools) ? item.deniedTools : [])
      )
    ]
    return deniedTools.length > 0
      ? `${data.message}\nDenied tools: ${deniedTools.join(', ')}`
      : data.message
  }

  const details = data.details == null
    ? undefined
    : typeof data.details === 'string'
    ? data.details
    : JSON.stringify(data.details, null, 2)

  return details ? `${data.message}\n${details}` : data.message
}

export const getAdapterInteractionMessage = (payload: AskUserQuestionParams) => {
  const header = payload.kind === 'permission' ? 'Permission required' : 'Input required'
  const optionLines = (payload.options ?? [])
    .map((option) => {
      const value = option.value ?? option.label
      return option.description != null && option.description.trim() !== ''
        ? `- ${value}: ${option.description}`
        : `- ${value}`
    })
  return optionLines.length > 0
    ? `${header}\n${payload.question}\nOptions:\n${optionLines.join('\n')}`
    : `${header}\n${payload.question}`
}

export const shouldPrintResumeHint = (input: {
  shouldPrintOutput: boolean
  status: TaskDetail['status']
}) => !(input.shouldPrintOutput && input.status === 'completed')

export const handlePrintEvent = (input: {
  event: AdapterOutputEvent
  outputFormat: RunOutputFormat
  lastAssistantText: string | undefined
  didExitAfterError: boolean
  exitOnInteractionRequest?: boolean
  stopExitsStreamJson?: boolean
  log: (message: string) => void
  errorLog: (message: string) => void
  requestExit: (code: number) => void
}) => {
  const nextAssistantText = input.event.type === 'message'
    ? (getPrintableAssistantText(input.event.data) ?? input.lastAssistantText)
    : input.lastAssistantText

  if (input.event.type === 'interaction_request') {
    switch (input.outputFormat) {
      case 'stream-json':
      case 'json':
        input.log(JSON.stringify(input.event, null, 2))
        if (input.exitOnInteractionRequest === true) {
          input.requestExit(1)
        }
        return {
          lastAssistantText: nextAssistantText,
          didExitAfterError: input.didExitAfterError || input.exitOnInteractionRequest === true
        }
      case 'text':
        input.errorLog(getAdapterInteractionMessage(input.event.data.payload))
        if (input.exitOnInteractionRequest === true) {
          input.requestExit(1)
        }
        return {
          lastAssistantText: nextAssistantText,
          didExitAfterError: input.didExitAfterError || input.exitOnInteractionRequest === true
        }
    }
  }

  if (input.event.type === 'error') {
    const isFatal = input.event.data.fatal !== false

    switch (input.outputFormat) {
      case 'stream-json':
        input.log(JSON.stringify(input.event, null, 2))
        if (isFatal) {
          input.requestExit(1)
          return {
            lastAssistantText: nextAssistantText,
            didExitAfterError: true
          }
        }
        return {
          lastAssistantText: nextAssistantText,
          didExitAfterError: input.didExitAfterError
        }
      case 'json':
        if (isFatal) {
          input.log(JSON.stringify(input.event, null, 2))
          input.requestExit(1)
          return {
            lastAssistantText: nextAssistantText,
            didExitAfterError: true
          }
        }
        return {
          lastAssistantText: nextAssistantText,
          didExitAfterError: input.didExitAfterError
        }
      case 'text':
        if (isFatal) {
          input.errorLog(getAdapterErrorMessage(input.event.data))
          input.requestExit(1)
          return {
            lastAssistantText: nextAssistantText,
            didExitAfterError: true
          }
        }
        return {
          lastAssistantText: nextAssistantText,
          didExitAfterError: input.didExitAfterError
        }
    }
  }

  switch (input.outputFormat) {
    case 'stream-json':
      input.log(JSON.stringify(input.event, null, 2))
      if (input.event.type === 'stop' && input.stopExitsStreamJson === true && !input.didExitAfterError) {
        input.requestExit(0)
      }
      return {
        lastAssistantText: nextAssistantText,
        didExitAfterError: input.didExitAfterError
      }
    case 'json':
      if (input.event.type === 'stop' && !input.didExitAfterError) {
        input.log(JSON.stringify(input.event, null, 2))
        input.requestExit(0)
      }
      return {
        lastAssistantText: nextAssistantText,
        didExitAfterError: input.didExitAfterError
      }
    case 'text':
      if (input.event.type === 'stop' && !input.didExitAfterError) {
        const output = resolvePrintableStopText(input.event.data, nextAssistantText)
        if (output != null) {
          input.log(output)
        }
        input.requestExit(0)
      }
      return {
        lastAssistantText: nextAssistantText,
        didExitAfterError: input.didExitAfterError
      }
  }
}
