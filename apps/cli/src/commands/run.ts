import process from 'node:process'

import { Option } from 'commander'
import type { Command, OptionValueSource } from 'commander'

import type { AdapterErrorData, AdapterOutputEvent } from '@vibe-forge/core/adapter'
import type { ChatMessage } from '@vibe-forge/core'
import { callHook } from '@vibe-forge/core/hooks'
import { generateAdapterQueryOptions, run } from '@vibe-forge/core/controllers/task'
import { uuid } from '@vibe-forge/core/utils/uuid'

import { extractTextFromMessage } from '#~/mcp-sync/index.js'
import {
  loadInjectDefaultSystemPromptValue,
  mergeSystemPrompts
} from '#~/system-prompt.js'

import { extraOptions } from './@core/extra-options'

export const RUN_OUTPUT_FORMATS = ['text', 'json', 'stream-json'] as const

export type RunOutputFormat = (typeof RUN_OUTPUT_FORMATS)[number]

interface RunOptions {
  print: boolean
  model?: string
  adapter?: string
  systemPrompt?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  sessionId?: string
  resume?: boolean
  spec?: string
  entity?: string
  outputFormat?: RunOutputFormat
  includeMcpServer?: string[]
  excludeMcpServer?: string[]
  includeTool?: string[]
  excludeTool?: string[]
  includeSkill?: string[]
  excludeSkill?: string[]
  injectDefaultSystemPrompt?: boolean
}

export const createSessionExitController = <T extends { kill(): void }>(params?: {
  exit?: (code: number) => never | void
}) => {
  let session: T | undefined
  let pendingExitCode: number | undefined
  let didRequestExit = false
  const exit = params?.exit ?? process.exit

  return {
    bindSession(nextSession: T) {
      session = nextSession
      if (pendingExitCode == null) return
      session.kill()
      exit(pendingExitCode)
    },
    requestExit(code: number) {
      if (didRequestExit) return
      didRequestExit = true
      if (session != null) {
        session.kill()
        exit(code)
        return
      }
      pendingExitCode = code
    }
  }
}

export function registerRunCommand(program: Command) {
  program
    .argument('[description...]')
    .option('--print', 'Run in direct mode with printed output', false)
    .option('--model <model>', 'Model to use')
    .option('--adapter <adapter>', 'Adapter to use')
    .option('--system-prompt <prompt>', 'System prompt')
    .option(
      '--no-inject-default-system-prompt',
      'Do not inject the default system prompt generated from rules/skills/entities/specs'
    )
    .option('--permission-mode <mode>', 'Permission mode (default, acceptEdits, plan, dontAsk, bypassPermissions)')
    .option('--session-id <id>', 'Session ID')
    .option('--resume', 'Resume existing session', false)
    .addOption(
      new Option('--output-format <format>', 'Output format')
        .choices([...RUN_OUTPUT_FORMATS])
        .default('text')
    )
    .option('--spec <spec>', 'Load spec definition')
    .option('--entity <entity>', 'Load entity definition')
    .option('--include-mcp-server <server...>', 'Include MCP server')
    .option('--exclude-mcp-server <server...>', 'Exclude MCP server')
    .option('--include-tool <tool...>', 'Include tool')
    .option('--exclude-tool <tool...>', 'Exclude tool')
    .option('--include-skill <skill...>', 'Include skill')
    .option('--exclude-skill <skill...>', 'Exclude skill')
    .action(async (descriptionArgs: string[], opts: RunOptions, command: Command) => {
      const description = descriptionArgs.join(' ')
      let lastAssistantText: string | undefined
      let didExitAfterError = false
      const exitController = createSessionExitController()

      if (opts.spec && opts.entity) {
        console.error('Error: --spec and --entity are mutually exclusive.')
        process.exit(1)
      }

      const sessionId = opts.sessionId ?? uuid()
      const type = opts.resume ? 'resume' : 'create'

      const promptType = opts.spec ? 'spec' : (opts.entity ? 'entity' : undefined)
      const promptName = opts.spec || opts.entity
      const promptCWD = process.cwd()
      const [data, resolvedConfig] = await generateAdapterQueryOptions(
        promptType,
        promptName,
        promptCWD,
        opts.includeSkill || opts.excludeSkill
          ? {
              skills: {
                include: opts.includeSkill,
                exclude: opts.excludeSkill
              }
            }
          : undefined
      )
      const env = {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: process.env.__VF_PROJECT_AI_CTX_ID__ ?? sessionId
      }
      await callHook('GenerateSystemPrompt', {
        cwd: promptCWD,
        sessionId,
        type: promptType,
        name: promptName,
        data
      }, env)

      const injectDefaultSystemPrompt = await loadInjectDefaultSystemPromptValue(
        promptCWD,
        resolveInjectDefaultSystemPromptOption(
          opts.injectDefaultSystemPrompt,
          command.getOptionValueSource('injectDefaultSystemPrompt')
        )
      )

      const finalSystemPrompt = mergeSystemPrompts({
        generatedSystemPrompt: resolvedConfig.systemPrompt,
        userSystemPrompt: opts.systemPrompt,
        injectDefaultSystemPrompt
      })

      const tools = mergeListConfig(
        resolvedConfig.tools,
        opts.includeTool,
        opts.excludeTool
      )

      const mcpServers = mergeListConfig(
        resolvedConfig.mcpServers,
        opts.includeMcpServer,
        opts.excludeMcpServer
      )

      const { session } = await run({
        adapter: opts.adapter,
        cwd: process.cwd(),
        env: process.env
      }, {
        type,
        description,
        runtime: 'cli',
        sessionId,
        model: opts.model,
        systemPrompt: finalSystemPrompt,
        permissionMode: opts.permissionMode,
        mode: opts.print ? 'stream' : 'direct',
        tools,
        mcpServers,
        promptAssetIds: resolvedConfig.promptAssetIds,
        skills: opts.includeSkill || opts.excludeSkill
          ? {
              include: opts.includeSkill,
              exclude: opts.excludeSkill
            }
          : undefined,
        extraOptions,
        onEvent: (event: AdapterOutputEvent) => {
          if (opts.print) {
            const nextState = handlePrintEvent({
              event,
              outputFormat: opts.outputFormat ?? 'text',
              lastAssistantText,
              didExitAfterError,
              log: (message) => console.log(message),
              errorLog: (message) => console.error(message),
              requestExit: (code) => exitController.requestExit(code)
            })
            lastAssistantText = nextState.lastAssistantText
            didExitAfterError = nextState.didExitAfterError
          }
          if (event.type === 'exit') {
            exitController.requestExit(event.data.exitCode ?? 0)
          }
        }
      })
      exitController.bindSession(session)
    })
}

export const resolveInjectDefaultSystemPromptOption = (
  value: boolean | undefined,
  source: OptionValueSource | undefined
) => source === 'default' ? undefined : value

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
  const details = data.details == null
    ? undefined
    : typeof data.details === 'string'
    ? data.details
    : JSON.stringify(data.details, null, 2)

  return details ? `${data.message}\n${details}` : data.message
}

export const handlePrintEvent = (input: {
  event: AdapterOutputEvent
  outputFormat: RunOutputFormat
  lastAssistantText: string | undefined
  didExitAfterError: boolean
  log: (message: string) => void
  errorLog: (message: string) => void
  requestExit: (code: number) => void
}) => {
  const nextAssistantText = input.event.type === 'message'
    ? (getPrintableAssistantText(input.event.data) ?? input.lastAssistantText)
    : input.lastAssistantText

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

function mergeListConfig(
  config: { include?: string[]; exclude?: string[] } | undefined,
  includeOpts: string[] | undefined,
  excludeOpts: string[] | undefined
) {
  const include = config?.include || includeOpts
    ? [
        ...(config?.include ?? []),
        ...(includeOpts ?? [])
      ]
    : undefined

  const exclude = config?.exclude || excludeOpts
    ? [
        ...(config?.exclude ?? []),
        ...(excludeOpts ?? [])
      ]
    : undefined

  return include || exclude
    ? {
        include,
        exclude
      }
    : undefined
}
