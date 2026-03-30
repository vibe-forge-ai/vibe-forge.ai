import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterEvent, AdapterQueryOptions } from '@vibe-forge/types'
import { uuid } from '@vibe-forge/utils/uuid'

import { mapAdapterContentToClaudeContent } from '../protocol/content'
import { handleIncomingEvent } from '../protocol/incoming'
import type {
  ClaudeCodeBaseEvent,
  ClaudeCodeErrorResultEvent,
  ClaudeCodeIncomingEvent,
  ClaudeCodeUserEvent
} from '../protocol/types'
import { prepareClaudeExecution } from './prepare'

const stripAnsiSequences = (value: string) => {
  let output = ''
  let index = 0

  while (index < value.length) {
    if (value.charCodeAt(index) === 27 && value[index + 1] === '[') {
      index += 2
      while (index < value.length) {
        const code = value.charCodeAt(index)
        if (code >= 64 && code <= 126) {
          index += 1
          break
        }
        index += 1
      }
      continue
    }

    output += value[index]
    index += 1
  }

  return output
}

export const createClaudeSession = async (ctx: AdapterCtx, options: AdapterQueryOptions) => {
  const { logger } = ctx
  const { onEvent, description, mode = 'stream', extraOptions } = options
  const { cliPath, args, env, cwd, sessionId, executionType } = await prepareClaudeExecution(ctx, options)
  let didEmitFatalError = false

  const emitEvent = (event: Parameters<typeof onEvent>[0]) => {
    if (event.type === 'error' && event.data.fatal !== false) {
      didEmitFatalError = true
    }
    onEvent(event)
  }

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
    let canResumeMarked = executionType === 'resume'

    const markResumeReady = async () => {
      if (canResumeMarked) return
      canResumeMarked = true
      await ctx.cache.set('adapter.claude-code.resume-state', { canResume: true })
    }

    const clearResumeReady = async () => {
      canResumeMarked = false
      await ctx.cache.set('adapter.claude-code.resume-state', { canResume: false })
    }

    proc.stdout.on('data', (buf) => {
      const rawStr = String(buf)
      stdoutBuffer += rawStr
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        logger.debug('Claude Code CLI stdout:', { line })
        const cleanedLine = stripAnsiSequences(line)
        const trimmed = cleanedLine.trim()
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed) as ClaudeCodeIncomingEvent
            if (
              parsed.type === 'result' &&
              parsed.subtype === 'error_during_execution' &&
              (parsed as ClaudeCodeErrorResultEvent).errors.some(
                error => error.includes(`No conversation found with session ID: ${sessionId}`)
              )
            ) {
              void clearResumeReady()
            }
            if (
              executionType === 'create' &&
              (
                (parsed.type === 'system' && parsed.subtype === 'init') ||
                parsed.type === 'assistant' ||
                (parsed.type === 'result' && parsed.subtype === 'success')
              )
            ) {
              void markResumeReady()
            }
            handleIncomingEvent(parsed, emitEvent)
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

    let didEmitExit = false
    const emitExit = (data: { exitCode?: number; stderr?: string }) => {
      if (didEmitExit) return
      didEmitExit = true
      emitEvent({
        type: 'exit',
        data
      })
    }

    proc.on('error', (err) => {
      const message = err instanceof Error ? err.message : String(err)
      if (!didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: {
            message,
            details: err,
            fatal: true
          }
        })
      }
      emitExit({
        exitCode: 1,
        stderr: message
      })
    })

    proc.on('exit', (code) => {
      const stderr = stderrBuffer.join('')
      if ((code ?? 0) !== 0 && !didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: {
            message: stderr !== '' ? stderr : `Process exited with code ${code ?? 1}`,
            details: stderr !== '' ? { stderr } : { exitCode: code ?? 1 },
            fatal: true
          }
        })
      }
      emitExit({
        exitCode: code ?? undefined,
        stderr
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

  let didEmitExit = false
  const emitExit = (data: { exitCode?: number; stderr?: string }) => {
    if (didEmitExit) return
    didEmitExit = true
    emitEvent({
      type: 'exit',
      data
    })
  }

  proc.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err)
    if (!didEmitFatalError) {
      emitEvent({
        type: 'error',
        data: {
          message,
          details: err,
          fatal: true
        }
      })
    }
    emitExit({
      exitCode: 1,
      stderr: message
    })
  })

  proc.on('exit', (code) => {
    if ((code ?? 0) !== 0 && !didEmitFatalError) {
      emitEvent({
        type: 'error',
        data: {
          message: `Process exited with code ${code ?? 1}`,
          details: { exitCode: code ?? 1 },
          fatal: true
        }
      })
    }
    emitExit({
      exitCode: code ?? undefined
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
