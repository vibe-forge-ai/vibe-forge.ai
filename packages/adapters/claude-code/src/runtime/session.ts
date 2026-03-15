import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterEvent, AdapterQueryOptions } from '@vibe-forge/core/adapter'
import { uuid } from '@vibe-forge/core/utils/uuid'

import { mapAdapterContentToClaudeContent } from '../protocol/content'
import { handleIncomingEvent } from '../protocol/incoming'
import type { ClaudeCodeBaseEvent, ClaudeCodeIncomingEvent, ClaudeCodeUserEvent } from '../types'
import { prepareClaudeExecution } from './prepare'

export const createClaudeSession = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const { logger } = ctx
  const { onEvent, description, mode = 'stream', extraOptions } = options
  const { cliPath, args, env, cwd, sessionId } = await prepareClaudeExecution(ctx, options)

  if (mode === 'stream') {
    args.push(
      '--print',
      '--verbose',
      '--debug',
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      ...(extraOptions ?? [])
    )

    logger.info('Claude Code CLI command:', {
      cliPath,
      args,
      mode
    })
    const proc = spawn(cliPath, args, {
      env: { ...env, FORCE_COLOR: '1' },
      cwd,
      stdio: 'pipe'
    })

    let stdoutBuffer = ''

    proc.stdout.on('data', (buf) => {
      const rawStr = String(buf)
      stdoutBuffer += rawStr
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        logger.debug('Claude Code CLI stdout:', { line })
        const ansiRegex = new RegExp('\\u001B\\[[0-9;]*[a-z]', 'gi')
        const cleanedLine = line.replace(ansiRegex, '')
        const trimmed = cleanedLine.trim()
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            handleIncomingEvent(JSON.parse(trimmed) as ClaudeCodeIncomingEvent, onEvent)
          } catch (err) {
            console.error('Failed to parse JSON:', trimmed, err)
          }
        }
      }
    })

    const stderrBuffer: string[] = []
    proc.stderr.on('data', (buf) => {
      const rawStr = String(buf)
      stderrBuffer.push(rawStr)
    })

    proc.on('exit', (code) => {
      onEvent({
        type: 'exit',
        data: {
          exitCode: code ?? undefined,
          stderr: stderrBuffer.join('')
        }
      })
    })

    const emit = (event: AdapterEvent) => {
      let outputEvent: ClaudeCodeBaseEvent | ClaudeCodeUserEvent = {
        uuid: uuid(),
        timestamp: new Date().toISOString(),
        sessionId,
        cwd
      }
      switch (event.type) {
        case 'message': {
          outputEvent = {
            ...outputEvent,
            type: 'user',
            parentUuid: event.parentUuid ?? null,
            message: {
              id: `msg_${Date.now()}`,
              type: 'message',
              role: 'user',
              content: mapAdapterContentToClaudeContent(event.content),
              uuid: uuid()
            }
          }
          break
        }
        case 'interrupt': {
          outputEvent = {
            ...outputEvent,
            type: 'user',
            message: {
              role: 'user',
              content: [{ type: 'text', text: '[Request interrupted by user]' }]
            }
          }
          break
        }
        case 'stop': {
          proc.stdin.end()
          return
        }
        default:
          logger.warn('Unknown event:', event)
          break
      }
      proc.stdin.write(`${JSON.stringify(outputEvent)}\n`)
    }

    if (description) {
      emit({
        type: 'message',
        content: [
          { type: 'text', text: description }
        ]
      })
    }

    return {
      kill: () => proc.kill(),
      emit,
      pid: proc.pid
    }
  }

  args.push(
    ...(extraOptions ?? [])
  )
  logger.info('Claude Code CLI command:', {
    cliPath,
    args,
    extraOptions,
    mode
  })
  const proc = spawn(cliPath, args, {
    env: { ...env, FORCE_COLOR: '1' },
    cwd,
    stdio: 'inherit'
  })

  proc.on('exit', (code) => {
    onEvent({
      type: 'exit',
      data: {
        exitCode: code ?? undefined
      }
    })
  })

  return {
    kill: () => proc.kill(),
    emit: () => {
      console.warn('emit() is not supported in direct mode')
    },
    pid: proc.pid
  }
}
