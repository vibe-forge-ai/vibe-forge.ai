import process from 'node:process'

import { Option } from 'commander'
import type { Command, OptionValueSource } from 'commander'

import { generateAdapterQueryOptions, run } from '@vibe-forge/app-runtime'
import { loadInjectDefaultSystemPromptValue, mergeSystemPrompts } from '@vibe-forge/config'
import type { ChatMessage } from '@vibe-forge/core'
import { callHook } from '@vibe-forge/hooks'
import type { AdapterErrorData, AdapterOutputEvent, SessionInitInfo, TaskDetail } from '@vibe-forge/types'
import { getCache } from '@vibe-forge/utils/cache'
import { extractTextFromMessage } from '@vibe-forge/utils/chat-message'
import { uuid } from '@vibe-forge/utils/uuid'

import {
  clearCliSessionControl,
  formatResumeCommand,
  isCliSessionStopActive,
  readCliSessionControl,
  resolveCliSession,
  resolveCliSessionAdapter,
  writeCliSessionRecord
} from '#~/session-cache.js'
import type { CliSessionResumeRecord } from '#~/session-cache.js'
import { extraOptions } from './@core/extra-options'

export const RUN_OUTPUT_FORMATS = ['text', 'json', 'stream-json'] as const

export type RunOutputFormat = (typeof RUN_OUTPUT_FORMATS)[number]

export interface RunOptions {
  print: boolean
  model?: string
  effort?: 'low' | 'medium' | 'high' | 'max'
  adapter?: string
  systemPrompt?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  sessionId?: string
  resume?: string
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
  defaultVibeForgeMcpServer?: boolean
}

interface ActiveCliSessionRecord {
  resume: CliSessionResumeRecord
  detail: TaskDetail
}

interface ExitControllableSession {
  kill(): void
  emit?: (event: { type: 'stop' }) => void
}

export const createSessionExitController = <T extends ExitControllableSession>(params?: {
  exit?: (code: number) => never | void
}) => {
  let session: T | undefined
  let pendingExitCode: number | undefined
  let didRequestExit = false
  let didExit = false
  const exit = params?.exit ?? process.exit
  const signalSessionExit = (target: T) => {
    if (pendingExitCode === 0 && typeof target.emit === 'function') {
      target.emit({ type: 'stop' })
      return
    }
    target.kill()
  }

  return {
    bindSession(nextSession: T) {
      session = nextSession
      if (pendingExitCode == null) return
      signalSessionExit(session)
    },
    requestExit(code: number) {
      if (didRequestExit) return
      didRequestExit = true
      pendingExitCode = code
      if (session != null) {
        signalSessionExit(session)
      }
    },
    handleSessionExit(code: number) {
      if (didExit) return
      didExit = true
      exit(pendingExitCode ?? code)
    },
    getPendingExitCode() {
      return pendingExitCode
    }
  }
}

const getOutputFormat = (
  value: RunOutputFormat | undefined,
  source: OptionValueSource | undefined,
  fallback: RunOutputFormat
) => source === 'default' ? fallback : (value ?? 'text')

const getRunMode = (print: boolean): 'stream' | 'direct' => print ? 'stream' : 'direct'

export const resolveRunMode = (
  print: boolean,
  source: OptionValueSource | undefined,
  fallback: 'stream' | 'direct'
) => source === 'default' ? fallback : getRunMode(print)

export const getDisallowedResumeFlags = (
  opts: RunOptions,
  command: Command
) => {
  const disallowed: string[] = []

  if (opts.adapter) disallowed.push('--adapter')
  if (opts.model) disallowed.push('--model')
  if (opts.effort) disallowed.push('--effort')
  if (opts.systemPrompt) disallowed.push('--system-prompt')
  if (opts.permissionMode) disallowed.push('--permission-mode')
  if (opts.sessionId) disallowed.push('--session-id')
  if (opts.spec) disallowed.push('--spec')
  if (opts.entity) disallowed.push('--entity')
  if ((opts.includeMcpServer?.length ?? 0) > 0) disallowed.push('--include-mcp-server')
  if ((opts.excludeMcpServer?.length ?? 0) > 0) disallowed.push('--exclude-mcp-server')
  if ((opts.includeTool?.length ?? 0) > 0) disallowed.push('--include-tool')
  if ((opts.excludeTool?.length ?? 0) > 0) disallowed.push('--exclude-tool')
  if ((opts.includeSkill?.length ?? 0) > 0) disallowed.push('--include-skill')
  if ((opts.excludeSkill?.length ?? 0) > 0) disallowed.push('--exclude-skill')
  if (command.getOptionValueSource('injectDefaultSystemPrompt') !== 'default') {
    disallowed.push('--no-inject-default-system-prompt')
  }
  if (command.getOptionValueSource('defaultVibeForgeMcpServer') !== 'default') {
    disallowed.push('--no-default-vibe-forge-mcp-server')
  }

  return disallowed
}

const configureRunCommand = (command: Command) => {
  command
    .argument('[description...]')
    .option('--print', 'Print assistant output to stdout', false)
    .option('--model <model>', 'Model to use')
    .option('--effort <effort>', 'Effort to use (low, medium, high, max)')
    .option('--adapter <adapter>', 'Adapter to use')
    .option('--system-prompt <prompt>', 'System prompt')
    .option(
      '--no-inject-default-system-prompt',
      'Do not inject the default system prompt generated from rules/skills/entities/specs'
    )
    .option('--permission-mode <mode>', 'Permission mode (default, acceptEdits, plan, dontAsk, bypassPermissions)')
    .option('--session-id <id>', 'Session ID')
    .option('--resume <id>', 'Resume an existing session by session id')
    .addOption(
      new Option('--output-format <format>', 'Output format')
        .choices([...RUN_OUTPUT_FORMATS])
        .default('text')
    )
    .option('--spec <spec>', 'Load spec definition')
    .option('--entity <entity>', 'Load entity definition')
    .option('--include-mcp-server <server...>', 'Include MCP server')
    .option('--exclude-mcp-server <server...>', 'Exclude MCP server')
    .option('--no-default-vibe-forge-mcp-server', 'Do not enable the built-in Vibe Forge MCP server')
    .option('--include-tool <tool...>', 'Include tool')
    .option('--exclude-tool <tool...>', 'Exclude tool')
    .option('--include-skill <skill...>', 'Include skill')
    .option('--exclude-skill <skill...>', 'Exclude skill')
    .addHelpText(
      'after',
      `
Examples:
  vf "实现一个新的 list 筛选"
  vf run --adapter codex --print "读取 README 并总结"
  vf list --view default
  vf --resume <sessionId>

Notes:
  When using --resume, startup-only flags like --adapter, --model and --spec are loaded from cache and cannot be set again.
  The resolved adapter is pinned in cache, so later default adapter changes do not affect resume.
`
    )
    .action(async (descriptionArgs: string[], opts: RunOptions, command: Command) => {
      try {
        const description = descriptionArgs.join(' ')
        let lastAssistantText: string | undefined
        let didExitAfterError = false
        const exitController = createSessionExitController()
        const cwd = process.cwd()
        const generatedSessionId = opts.sessionId ?? uuid()

        if (opts.spec && opts.entity) {
          throw new Error('--spec and --entity are mutually exclusive.')
        }

        const isResume = opts.resume != null
        const outputFormatSource = command.getOptionValueSource('outputFormat')
        const printSource = command.getOptionValueSource('print')

        const runTaskOptions = isResume
          ? undefined
          : {
            adapter: opts.adapter,
            cwd,
            ctxId: process.env.__VF_PROJECT_AI_CTX_ID__ ?? generatedSessionId
          }

        const initialResumeRecord = isResume
          ? (() => {
            const disallowedFlags = getDisallowedResumeFlags(opts, command)
            if (disallowedFlags.length > 0) {
              throw new Error(`Resume mode does not accept ${disallowedFlags.join(', ')}.`)
            }
            return resolveCliSession(cwd, opts.resume!)
          })()
          : undefined

        const cachedSession = await initialResumeRecord
        const cachedAdapter = cachedSession == null
          ? undefined
          : (resolveCliSessionAdapter(cachedSession) || undefined)
        const sessionId = cachedSession?.resume?.sessionId ?? generatedSessionId
        const ctxId = cachedSession?.resume?.ctxId ?? runTaskOptions?.ctxId ?? sessionId
        const outputFormat = getOutputFormat(
          opts.outputFormat,
          outputFormatSource,
          cachedSession?.resume?.outputFormat ?? 'text'
        )

        const adapterOptions = cachedSession?.resume != null
          ? {
            ...cachedSession.resume.adapterOptions,
            type: 'resume' as const,
            description,
            mode: resolveRunMode(
              opts.print,
              printSource,
              cachedSession.resume.adapterOptions.mode ?? 'direct'
            ),
            extraOptions
          }
          : await (async () => {
            const promptType = opts.spec ? 'spec' : (opts.entity ? 'entity' : undefined)
            const promptName = opts.spec || opts.entity
            const [data, resolvedConfig] = await generateAdapterQueryOptions(
              promptType,
              promptName,
              cwd,
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
              __VF_PROJECT_AI_CTX_ID__: ctxId
            }
            await callHook('GenerateSystemPrompt', {
              cwd,
              sessionId,
              type: promptType,
              name: promptName,
              data
            }, env)

            const injectDefaultSystemPrompt = await loadInjectDefaultSystemPromptValue(
              cwd,
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

            return {
              type: 'create' as const,
              description,
              runtime: 'cli' as const,
              sessionId,
              model: opts.model,
              effort: opts.effort,
              systemPrompt: finalSystemPrompt,
              permissionMode: opts.permissionMode,
              mode: getRunMode(opts.print),
              tools,
              mcpServers,
              useDefaultVibeForgeMcpServer: resolveDefaultVibeForgeMcpServerOption(
                opts.defaultVibeForgeMcpServer,
                command.getOptionValueSource('defaultVibeForgeMcpServer')
              ),
              promptAssetIds: resolvedConfig.promptAssetIds,
              skills: opts.includeSkill || opts.excludeSkill
                ? {
                  include: opts.includeSkill,
                  exclude: opts.excludeSkill
                }
                : undefined,
              extraOptions,
              assetBundle: resolvedConfig.assetBundle
            }
          })()
        const shouldPrintOutput = adapterOptions.mode === 'stream'
        const {
          type: _adapterType,
          description: _adapterDescription,
          ...cachedAdapterOptions
        } = adapterOptions

        const record: ActiveCliSessionRecord = {
          resume: {
            version: 1 as const,
            ctxId,
            sessionId,
            cwd: cachedSession?.resume?.cwd ?? cwd,
            description: description || cachedSession?.resume?.description,
            createdAt: cachedSession?.resume?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
            resolvedAdapter: cachedSession?.resume?.resolvedAdapter ?? cachedAdapter,
            taskOptions: {
              ...(cachedSession?.resume?.taskOptions ?? {
                cwd,
                ctxId
              }),
              adapter: cachedAdapter ?? runTaskOptions?.adapter
            },
            adapterOptions: cachedAdapterOptions,
            outputFormat
          },
          detail: {
            ctxId,
            sessionId,
            status: 'pending',
            startTime: cachedSession?.detail?.startTime ?? Date.now(),
            description: description || cachedSession?.detail?.description || cachedSession?.resume?.description,
            adapter: cachedSession?.detail?.adapter ?? cachedAdapter,
            model: cachedSession?.detail?.model ?? cachedSession?.resume?.adapterOptions.model
          }
        }

        let persistQueue = Promise.resolve()
        const persistRecord = () => {
          persistQueue = persistQueue
            .catch(() => {})
            .then(() => writeCliSessionRecord(cwd, ctxId, sessionId, record))
            .catch((error) => {
              const message = error instanceof Error ? error.message : String(error)
              console.error(`[vf] Failed to update session cache: ${message}`)
            })
          return persistQueue
        }
        const updateInitRecord = (info: SessionInitInfo, pid: number | undefined) => {
          const resolvedAdapter = info.adapter ?? record.resume.resolvedAdapter ?? record.resume.taskOptions.adapter
          record.resume = {
            ...record.resume,
            updatedAt: Date.now(),
            resolvedAdapter,
            taskOptions: {
              ...record.resume.taskOptions,
              adapter: resolvedAdapter
            },
            adapterOptions: {
              ...record.resume.adapterOptions,
              model: info.model,
              effort: info.effort ?? record.resume.adapterOptions.effort
            }
          }
          record.detail = {
            ...record.detail,
            status: 'running',
            pid: pid ?? record.detail.pid,
            adapter: resolvedAdapter ?? record.detail.adapter,
            model: info.model ?? record.detail.model
          }
          void persistRecord()
        }

        await persistRecord()

        let boundSession: (ExitControllableSession & { pid?: number }) | undefined
        const handleExit = (exitCode: number) => {
          void (async () => {
            const endedAt = Date.now()
            const [persistedDetail, control] = await Promise.all([
              getCache(cwd, ctxId, sessionId, 'detail'),
              readCliSessionControl(cwd, ctxId, sessionId)
            ])
            record.resume = {
              ...record.resume,
              updatedAt: endedAt
            }
            record.detail = {
              ...record.detail,
              endTime: endedAt,
              exitCode,
              status: persistedDetail?.status === 'stopped' || isCliSessionStopActive(control, endedAt)
                ? 'stopped'
                : exitCode === 0
                ? 'completed'
                : 'failed'
            }
            await persistRecord()
            await persistQueue
            await clearCliSessionControl(cwd, ctxId, sessionId)
            console.error(formatResumeCommand(sessionId))
            exitController.handleSessionExit(exitCode)
          })()
        }

        const { session, resolvedAdapter } = await run({
          adapter: record.resume.resolvedAdapter ?? record.resume.taskOptions.adapter,
          cwd: record.resume.taskOptions.cwd ?? record.resume.cwd,
          ctxId,
          env: process.env
        }, {
          ...adapterOptions,
          onEvent: (event: AdapterOutputEvent) => {
            if (event.type === 'init') {
              updateInitRecord(event.data, boundSession?.pid)
            }
            if (shouldPrintOutput) {
              const shouldSuppressFatalError = event.type === 'error' &&
                event.data.fatal !== false &&
                exitController.getPendingExitCode() === 0
              const nextState = handlePrintEvent({
                event,
                outputFormat,
                lastAssistantText,
                didExitAfterError,
                suppressFatalError: shouldSuppressFatalError,
                log: (message) => console.log(message),
                errorLog: (message) => console.error(message),
                requestExit: (code) => exitController.requestExit(code)
              })
              lastAssistantText = nextState.lastAssistantText
              didExitAfterError = nextState.didExitAfterError
            }
            if (event.type === 'exit') {
              handleExit(exitController.getPendingExitCode() ?? event.data.exitCode ?? 0)
            }
          }
        })
        boundSession = session
        record.resume = {
          ...record.resume,
          resolvedAdapter: resolvedAdapter ?? record.resume.resolvedAdapter,
          taskOptions: {
            ...record.resume.taskOptions,
            adapter: resolvedAdapter ?? record.resume.taskOptions.adapter
          }
        }
        record.detail = {
          ...record.detail,
          pid: session.pid ?? record.detail.pid,
          status: record.detail.status === 'pending' ? 'running' : record.detail.status,
          adapter: resolvedAdapter ?? record.detail.adapter
        }
        void persistRecord()
        exitController.bindSession(session)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        process.exit(1)
      }
    })
}

export function registerRunCommand(program: Command) {
  configureRunCommand(
    program
      .command('run')
      .description('Run or resume a session')
  )
}

export const resolveInjectDefaultSystemPromptOption = (
  value: boolean | undefined,
  source: OptionValueSource | undefined
) => source === 'default' ? undefined : value

export const resolveDefaultVibeForgeMcpServerOption = (
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
  suppressFatalError?: boolean
  log: (message: string) => void
  errorLog: (message: string) => void
  requestExit: (code: number) => void
}) => {
  const nextAssistantText = input.event.type === 'message'
    ? (getPrintableAssistantText(input.event.data) ?? input.lastAssistantText)
    : input.lastAssistantText

  if (input.event.type === 'error') {
    const isFatal = input.event.data.fatal !== false
    if (isFatal && input.suppressFatalError) {
      return {
        lastAssistantText: nextAssistantText,
        didExitAfterError: input.didExitAfterError
      }
    }

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
