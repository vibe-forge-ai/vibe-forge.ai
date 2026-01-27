import { spawn } from 'node:child_process'

import { defineAdapter, loadEnv } from '@vibe-forge/core'
import { filterObject } from '@vibe-forge/core/utils/filter'
import type { AdapterCtx, AdapterEvent, AdapterQueryOptions, ChatMessage } from '@vibe-forge/core'
import { uuid } from '@vibe-forge/core/utils/uuid'

import type {
  ClaudeCodeContent,
  ClaudeCodeContentText,
  ClaudeCodeContentToolResult,
  ClaudeCodeContentToolUse,
  ClaudeCodeIncomingEvent,
  ClaudeCodeUserEvent
} from './types'

declare module '@vibe-forge/core' {
  interface AdapterMap {
  }
  interface Cache {
    'adapter.claude-code.mcp': Record<string, unknown>
    'adapter.claude-code.settings': Record<string, unknown>
  }
}

const resolveSettings = (unresolvedSettings: Record<string, any>) => {
  const { includeMcpServers, excludeMcpServers, ...rest } = unresolvedSettings
  return {
    ...rest,
    plansDirectory: './.ai/works'
  }
}

function handleIncomingEvent(data: ClaudeCodeIncomingEvent, onEvent: AdapterQueryOptions['onEvent']) {
  // 1. Handle Init Event
  if (data.type === 'system') {
    if (data.subtype === 'init') {
      onEvent({
        type: 'init',
        data: {
          uuid: data.uuid,
          model: data.model,
          version: data.claude_code_version,
          tools: (data.tools) as string[],
          slashCommands: (data.slash_commands) as string[],
          cwd: data.cwd,
          agents: (data.agents) as string[]
        }
      })
    }
  }

  // 2. Handle Assistant Message Event
  if (data.type === 'assistant' && data.message != null) {
    const contentParts = data.message.content
    const textContent = contentParts
      .filter((p): p is ClaudeCodeContentText => p.type === 'text')
      .map(p => p.text)
      .join('')

    const toolUsePart = contentParts.find((p): p is ClaudeCodeContentToolUse => p.type === 'tool_use')

    const assistant: ChatMessage = {
      id: data.uuid,
      role: 'assistant',
      content: textContent,
      createdAt: Date.now(),
      model: data.message.model || data.model,
      usage: data.message.usage
    }

    if (toolUsePart != null) {
      const toolItem = {
        type: 'tool_use' as const,
        id: toolUsePart.id,
        name: toolUsePart.name,
        input: (toolUsePart.input ?? toolUsePart.args ?? {}) as Record<string, any>
      }

      if (textContent !== '') {
        assistant.content = [
          { type: 'text', text: textContent },
          toolItem
        ]
      } else {
        assistant.content = [toolItem]
      }
    }
    onEvent({ type: 'message', data: assistant })
  }

  // 3. Handle Tool Result Event (from user message)
  if (data.type === 'user' && data.message != null && Array.isArray(data.message.content)) {
    const content = data.message.content
    const toolResultPart = content.find((p): p is ClaudeCodeContentToolResult => p.type === 'tool_result')
    if (toolResultPart != null) {
      const resultMessage: ChatMessage = {
        id: data.uuid,
        role: 'assistant',
        content: [{
          type: 'tool_result' as const,
          tool_use_id: toolResultPart.tool_use_id,
          content: toolResultPart.content,
          is_error: toolResultPart.is_error ?? false
        }],
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

  // 5. Handle Result Event
  if (data.type === 'result') {
    let messageData: ChatMessage | undefined
    if (data.result != null && data.result !== '') {
      messageData = {
        id: data.uuid,
        role: 'assistant',
        content: data.result,
        createdAt: Date.now(),
        usage: data.usage
      }
    }
    // 发送 stop 事件，告知当前任务结束，并附带结果数据（如果有）
    // 如果有 result，说明任务正常完成
    onEvent({ type: 'stop', data: messageData })
  }
}

async function prepareClaudeExecution(ctx: AdapterCtx, options: AdapterQueryOptions) {
  const { env, cwd, cache, settings } = ctx
  const {
    sessionId,
    model,
    type,
    systemPrompt,
    appendSystemPrompt = true,
    mcpServers: inputMCPServersRule,
    tools: inputToolsRule
  } = options

  const serverEnv = loadEnv()

  // Logic for Settings and MCP
  const { mcpServers, ...unresolvedSettings } = settings as any
  unresolvedSettings.permissions = unresolvedSettings.permissions || {}
  unresolvedSettings.permissions.allow = [
    ...(unresolvedSettings.permissions.allow ?? []),
    ...(inputToolsRule?.include ?? [])
  ]
  unresolvedSettings.permissions.deny = [
    ...(unresolvedSettings.permissions.deny ?? []),
    ...(inputToolsRule?.exclude ?? [])
  ]

  const resolvedSettings = resolveSettings(unresolvedSettings)

  const includeMcpServers = [
    ...(unresolvedSettings.includeMcpServers ?? []),
    ...(inputMCPServersRule?.include ?? [])
  ]
  const excludeMcpServers = [
    ...(unresolvedSettings.excludeMcpServers ?? []),
    ...(inputMCPServersRule?.exclude ?? [])
  ]

  const filteredMcpServers = filterObject(mcpServers || {}, {
    include: includeMcpServers,
    exclude: excludeMcpServers
  })

  const { cachePath: mcpCachePath } = await cache.set(
    'adapter.claude-code.mcp',
    { mcpServers: filteredMcpServers }
  )
  const { cachePath: settingsCachePath } = await cache.set(
    'adapter.claude-code.settings',
    resolvedSettings
  )

  // Default ccr path if not provided in env
  const ccrPath = env.CLAUDE_CODE_CLI_PATH || 'claude'

  // Common Arguments
  const args: string[] = [
    ...(serverEnv.CLAUDE_CODE_CLI_ARGS?.split(/\s+/).filter(Boolean) as string[]),
    '--mcp-config',
    mcpCachePath,
    '--settings',
    settingsCachePath,
    '--permission-mode',
    'bypassPermissions'
  ]

  // Handle session type logic
  if (type === 'create') {
    args.push('--session-id', sessionId)
  } else if (type === 'resume') {
    args.push('--resume', sessionId)
  }

  // Add optional flags
  if (model != null && model !== '') args.push('--model', model)

  // Handle system prompt logic
  if (systemPrompt != null && systemPrompt !== '') {
    if (appendSystemPrompt) {
      args.push('--append-system-prompt', systemPrompt)
    } else {
      args.push('--system-prompt', systemPrompt)
    }
  }

  return { ccrPath, args, env, cwd, sessionId }
}

export default defineAdapter({
  query: async (ctx, options) => {
    const { logger } = ctx
    const { onEvent, mode = 'stream' } = options
    const { ccrPath, args, env, cwd, sessionId } = await prepareClaudeExecution(ctx, options)

    if (mode === 'stream') {
      // Append stream-specific args
      args.push(
        '--print',
        '--verbose',
        '--debug',
        '--output-format', 'stream-json',
        '--input-format', 'stream-json'
      )

      logger.info('Claude Code CLI command:', {
        ccrPath,
        args,
        mode,
      })
      const proc = spawn(ccrPath, args, {
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
          const trimmed = line.trim()
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
              uuid: uuid(),
              parentUuid: event.parentUuid ?? null,
              timestamp: new Date().toISOString(),
              sessionId,
              cwd,
              message: {
                id: `msg_${Date.now()}`,
                type: 'message',
                role: 'user',
                content: event.content as string | ClaudeCodeContent[],
                uuid: uuid()
              }
            }
            const json = JSON.stringify(claudeEvent)
            proc.stdin.write(`${json}\n`)
          } else if (event.type === 'interrupt') {
            const interruptEvent: ClaudeCodeUserEvent = {
              type: 'user',
              uuid: uuid(),
              timestamp: new Date().toISOString(),
              sessionId,
              cwd,
              message: {
                role: 'user',
                content: [{ type: 'text', text: '[Request interrupted by user]' }]
              }
            }
            const json = JSON.stringify(interruptEvent)
            proc.stdin.write(`${json}\n`)
          } else if (event.type === 'stop') {
            proc.stdin.end()
          }
        }
      }
    } else {
      logger.info('Claude Code CLI command:', {
        ccrPath,
        args,
        mode,
      })
      // Direct mode
      const proc = spawn(ccrPath, args, {
        env: { ...env, FORCE_COLOR: '1' },
        cwd,
        stdio: 'inherit'
      })

      proc.on('exit', (code) => {
        onEvent({
          type: 'exit',
          data: {
            exitCode: code
          }
        })
      })

      return {
        kill: () => proc.kill(),
        emit: () => {
          // No-op for direct mode as we can't easily inject JSON events into a TTY process
          console.warn('emit() is not supported in direct mode')
        }
      }
    }
  }
})
