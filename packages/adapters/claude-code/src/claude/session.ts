import { spawn } from 'node:child_process'

import type { AdapterCtx, AdapterEvent, AdapterQueryOptions } from '@vibe-forge/types'
import { uuid } from '@vibe-forge/utils/uuid'

import { mapAdapterContentToClaudeContent } from '../protocol/content'
import { handleIncomingEvent } from '../protocol/incoming'
import type {
  ClaudeCodeErrorResultEvent,
  ClaudeCodeIncomingEvent,
  ClaudeCodeUserEvent
} from '../protocol/types'
import { prepareClaudeExecution } from './prepare'

const isMissingConversationError = (errors: string[] | undefined, sessionId: string) => (
  (errors ?? []).some(error => error.includes(`No conversation found with session ID: ${sessionId}`))
)

const buildClaudeCreateArgs = (args: string[], sessionId: string) => {
  const nextArgs = [...args]
  const resumeIndex = nextArgs.findIndex(arg => arg === '--resume')
  if (resumeIndex === -1) return nextArgs

  nextArgs.splice(resumeIndex, 2, '--session-id', sessionId)
  return nextArgs
}

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
  let { cliPath, args, env, cwd, sessionId, effort, executionType } = await prepareClaudeExecution(ctx, options)
  let didEmitFatalError = false

  const emitEvent = (event: Parameters<typeof onEvent>[0]) => {
    if (event.type === 'error' && event.data.fatal !== false) {
      didEmitFatalError = true
    }
    onEvent(event)
  }

  if (mode === 'stream') {
    type ReplayableMessageEvent = Extract<AdapterEvent, { type: 'message' }>

    const markResumeReady = async () => {
      if (canResumeMarked) return
      canResumeMarked = true
      await ctx.cache.set('adapter.claude-code.resume-state', { canResume: true })
    }

    const clearResumeReady = async () => {
      canResumeMarked = false
      await ctx.cache.set('adapter.claude-code.resume-state', { canResume: false })
    }
    let proc: ReturnType<typeof spawn>
    let stdoutBuffer = ''
    let stderrBuffer: string[] = []
    let canResumeMarked = executionType === 'resume'
    let allowMissingConversationFallback = executionType === 'resume'
    let pendingResumeCreateFallback = false
    let resumeStateUpdate = Promise.resolve()
    let replayableMessages: ReplayableMessageEvent[] = []

    const closeMissingConversationFallbackWindow = () => {
      allowMissingConversationFallback = false
      replayableMessages = []
    }

    let didEmitExit = false
    const emitExit = (data: { exitCode?: number; stderr?: string }) => {
      if (didEmitExit) return
      didEmitExit = true
      emitEvent({
        type: 'exit',
        data
      })
    }

    const emitMessageToProcess = (event: ReplayableMessageEvent) => {
      const outputEvent: ClaudeCodeUserEvent = {
        uuid: uuid(),
        timestamp: new Date().toISOString(),
        sessionId,
        cwd,
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
      proc.stdin.write(`${JSON.stringify(outputEvent)}\n`)
    }

    const emitEventToProcess = (event: AdapterEvent) => {
      switch (event.type) {
        case 'message': {
          emitMessageToProcess(event)
          break
        }
        case 'interrupt': {
          const outputEvent: ClaudeCodeUserEvent = {
            uuid: uuid(),
            timestamp: new Date().toISOString(),
            sessionId,
            cwd,
            type: 'user',
            message: {
              role: 'user',
              content: [{ type: 'text', text: '[Request interrupted by user]' }]
            }
          }
          proc.stdin.write(`${JSON.stringify(outputEvent)}\n`)
          break
        }
        case 'stop': {
          proc.stdin.end()
          break
        }
      }
    }

    const spawnArgs = () => [
      ...args,
      '--print',
      '--verbose',
      '--debug',
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      ...(extraOptions ?? [])
    ]

    const restartWithCreateFallback = async () => {
      await resumeStateUpdate
      args = buildClaudeCreateArgs(args, sessionId)
      executionType = 'create'
      canResumeMarked = false
      allowMissingConversationFallback = true
      startProcess()
      for (const event of replayableMessages) {
        emitEventToProcess(event)
      }
    }

    const startProcess = () => {
      const nextArgs = spawnArgs()
      logger.info('Claude Code CLI command:', {
        cliPath,
        args: nextArgs,
        mode
      })
      proc = spawn(cliPath, nextArgs, {
        env: { ...env, FORCE_COLOR: '1' },
        cwd,
        stdio: 'pipe'
      })
      stdoutBuffer = ''
      stderrBuffer = []

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
                isMissingConversationError((parsed as ClaudeCodeErrorResultEvent).errors, sessionId) &&
                allowMissingConversationFallback
              ) {
                pendingResumeCreateFallback = true
                allowMissingConversationFallback = false
                resumeStateUpdate = clearResumeReady()
                continue
              }
              if (
                (parsed.type === 'system' && parsed.subtype === 'init') ||
                parsed.type === 'assistant' ||
                (parsed.type === 'result' && parsed.subtype === 'success')
              ) {
                closeMissingConversationFallbackWindow()
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
              handleIncomingEvent(parsed, emitEvent, effort)
            } catch (err) {
              console.error('Failed to parse JSON:', trimmed, err)
            }
          }
        }
      })

      proc.stderr.on('data', (buf) => {
        const rawStr = String(buf)
        stderrBuffer.push(rawStr)
      })

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
        if (pendingResumeCreateFallback) {
          pendingResumeCreateFallback = false
          void restartWithCreateFallback().catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            if (!didEmitFatalError) {
              emitEvent({
                type: 'error',
                data: {
                  message,
                  details: error,
                  fatal: true
                }
              })
            }
            emitExit({
              exitCode: 1,
              stderr: message
            })
          })
          return
        }

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
    }

    startProcess()

    const emit = (event: AdapterEvent) => {
      if (event.type === 'message' && (allowMissingConversationFallback || pendingResumeCreateFallback)) {
        replayableMessages.push(event)
      }
      if (pendingResumeCreateFallback) {
        return
      }
      emitEventToProcess(event)
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
      stop: () => proc.stdin.end(),
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
