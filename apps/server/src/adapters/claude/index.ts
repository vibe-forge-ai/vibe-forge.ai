import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

import { v4 as uuidv4 } from 'uuid'

import { defineAdapter } from '#~/adapters/core.js'
import { loadEnv } from '#~/env.js'
import { type AdapterEvent, type AdapterOptions, type AdapterOutputEvent } from '@vibe-forge/core'

import type {
  ClaudeCodeContentText,
  ClaudeCodeContentToolResult,
  ClaudeCodeContentToolUse,
  ClaudeCodeIncomingEvent,
  ClaudeCodeUserEvent
} from './types.js'

export const adapter = defineAdapter((options: AdapterOptions) => {
  const {
    env,
    cwd,
    sessionId,
    model,
    type,
    systemPrompt,
    appendSystemPrompt = true,
    onEvent
  } = options

  // Default ccr path if not provided in env
  const ccrPath = env.CLAUDE_CODE_CLI_PATH || resolve('./node_modules/.bin/ccr')

  // Arguments based on user request
  const args: string[] = [
    'code',
    '--print',
    '--verbose',
    '--debug',
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json'
  ]

  // Handle session type logic
  if (type === 'create') {
    args.push('--session-id', sessionId)
  } else if (type === 'resume') {
    args.push('--resume', sessionId)
  }

  // Add optional flags
  if (model) args.push('--model', model)

  // Handle system prompt logic
  if (systemPrompt) {
    if (appendSystemPrompt) {
      args.push('--append-system-prompt', systemPrompt)
    } else {
      args.push('--system-prompt', systemPrompt)
    }
  }

  const serverEnv = loadEnv()

  // Add custom CLI args from env if present
  if (serverEnv.CLAUDE_CODE_CLI_ARGS) {
    const customArgs = serverEnv.CLAUDE_CODE_CLI_ARGS.split(/\s+/).filter(Boolean)
    args.push(...customArgs)
  }

  const logDir = isAbsolute(serverEnv.LOG_DIR)
    ? serverEnv.LOG_DIR
    : join(process.cwd(), serverEnv.LOG_DIR)
  const sessionLogDir = join(logDir, sessionId)
  const spawnLogFile = join(sessionLogDir, 'claude.cli.spawn.log.jsonl')

  if (!existsSync(sessionLogDir)) {
    mkdirSync(sessionLogDir, { recursive: true })
  }

  const writeSpawnLog = (data: string) => {
    try {
      appendFileSync(spawnLogFile, data + (data.endsWith('\n') ? '' : '\n'))
    } catch (err) {
      console.error('[claude adapter] failed to write spawn log:', err)
    }
  }

  writeSpawnLog(`[SPAWN] command: ${ccrPath} args: ${JSON.stringify(args)}`)

  const proc = spawn(ccrPath, args, {
    env: { ...env, FORCE_COLOR: '1' },
    cwd
  })

  let stdoutBuffer = ''

  proc.stdout.on('data', (buf) => {
    const rawStr = String(buf)
    writeSpawnLog(rawStr)
    console.log({ sessionId, rawStr })
    stdoutBuffer += rawStr
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.endsWith('}')) {
        try {
          const data = JSON.parse(trimmed) as ClaudeCodeIncomingEvent
          // Always emit raw event for debugging/legacy
          onEvent({ type: 'raw', data })

          // 1. Handle Init Event
          if (data.type === 'system') {
            if (data.subtype === 'init') {
              onEvent({
                type: 'init',
                data: {
                  model: data.model,
                  version: data.claude_code_version,
                  tools: (data.tools || []) as string[],
                  slashCommands: (data.slash_commands || []) as string[],
                  cwd: data.cwd,
                  agents: (data.agents || []) as string[]
                }
              })
            }
          }

          // 2. Handle Assistant Message Event
          if (data.type === 'assistant' && data.message) {
            const contentParts = data.message.content || []
            const textContent = contentParts
              .filter((p): p is ClaudeCodeContentText => p.type === 'text')
              .map(p => p.text)
              .join('')

            const toolUsePart = contentParts.find((p): p is ClaudeCodeContentToolUse => p.type === 'tool_use')

            const assistant: any = {
              id: data.uuid,
              role: 'assistant',
              content: (textContent || (toolUsePart ? [] : '')) as string | any[],
              createdAt: Date.now(),
              model: data.message.model || data.model,
              usage: data.message.usage
            }

            if (toolUsePart) {
              const toolItem = {
                type: 'tool_use',
                id: toolUsePart.id,
                name: toolUsePart.name,
                input: (toolUsePart.input || toolUsePart.args || {}) as Record<string, any>
              }

              if (textContent) {
                assistant.content = [
                  { type: 'text', text: textContent },
                  toolItem
                ] as any[]
              } else {
                assistant.content = [toolItem] as any[]
              }
            }
            onEvent({ type: 'message', data: assistant })
          }

          // 3. Handle Tool Result Event (from user message)
          if (data.type === 'user' && data.message && Array.isArray(data.message.content)) {
            const content = data.message.content
            const toolResultPart = content.find((p): p is ClaudeCodeContentToolResult => p.type === 'tool_result')
            if (toolResultPart) {
              const resultMessage: any = {
                id: data.uuid,
                role: 'assistant',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolResultPart.tool_use_id,
                  content: toolResultPart.content,
                  is_error: toolResultPart.is_error || false
                }] as any[],
                createdAt: Date.now()
              }
              onEvent({ type: 'message', data: resultMessage })
            }
          }

          // 4. Handle Summary Event
          if (data.type === 'summary') {
            onEvent({
              type: 'summary',
              data: {
                summary: data.summary,
                leafUuid: data.leafUuid
              }
            })
          }
        } catch (err) {
          console.error('Failed to parse JSON:', trimmed, err)
        }
      }
    }
  })

  const stderrBuffer: string[] = []
  proc.stderr.on('data', (buf) => {
    const rawStr = String(buf)
    writeSpawnLog(rawStr)
    stderrBuffer.push(rawStr)
  })

  proc.on('exit', (code) => {
    writeSpawnLog(`[EXIT] code: ${code}`)
    onEvent({
      type: 'exit',
      data: {
        exitCode: code,
        stderr: stderrBuffer.join('')
      }
    })
  })

  return {
    kill: () => proc.kill(),
    emit: (event: AdapterEvent) => {
      if (event.type === 'message') {
        const claudeEvent: ClaudeCodeUserEvent = {
          type: 'user',
          uuid: uuidv4(),
          parentUuid: event.parentUuid ?? null,
          timestamp: new Date().toISOString(),
          sessionId,
          cwd,
          message: {
            id: `msg_${Date.now()}`,
            type: 'message',
            role: 'user',
            content: event.content as any,
            uuid: uuidv4()
          }
        }
        const json = JSON.stringify(claudeEvent)
        writeSpawnLog(json)
        proc.stdin.write(json + '\n')
      } else if (event.type === 'interrupt') {
        const interruptEvent: ClaudeCodeUserEvent = {
          type: 'user',
          uuid: uuidv4(),
          timestamp: new Date().toISOString(),
          sessionId,
          cwd,
          message: {
            role: 'user',
            content: [{ type: 'text', text: '[Request interrupted by user]' }]
          }
        }
        const json = JSON.stringify(interruptEvent)
        writeSpawnLog(json)
        proc.stdin.write(json + '\n')
      } else if (event.type === 'stop') {
        // 对于 stop 事件，如果 CLI 支持，可以发送特定信号或关闭 stdin
        writeSpawnLog('[STOP]')
        proc.stdin.end()
      }
    }
  }
})
