import process from 'node:process'

import { Option } from 'commander'
import type { Command } from 'commander'

import { generateAdapterQueryOptions, run } from '@vibe-forge/app-runtime'
import { loadInjectDefaultSystemPromptValue, mergeSystemPrompts } from '@vibe-forge/config'
import { callHook } from '@vibe-forge/hooks'
import type { AdapterOutputEvent, SessionInitInfo } from '@vibe-forge/types'
import { getCache } from '@vibe-forge/utils/cache'
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
import { extraOptions } from '../@core/extra-options'
import { attachInputBridge } from './input-bridge'
import {
  getDisallowedResumeFlags,
  getOutputFormat,
  mergeListConfig,
  resolveDefaultVibeForgeMcpServerOption,
  resolveInjectDefaultSystemPromptOption,
  resolveRunMode
} from './options'
import { handlePrintEvent, shouldPrintResumeHint } from './output'
import { createSessionExitController } from './session-exit-controller'
import type { ActiveCliSessionRecord, ExitControllableSession, RunOptions } from './types'
import { RUN_INPUT_FORMATS, RUN_OUTPUT_FORMATS } from './types'

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
    .addOption(
      new Option('--input-format <format>', 'Input format for print mode stdin control')
        .choices([...RUN_INPUT_FORMATS])
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
    .action(async (descriptionArgs: string[], opts: RunOptions, currentCommand: Command) => {
      try {
        const description = descriptionArgs.join(' ')
        let lastAssistantText: string | undefined
        let didExitAfterError = false
        let inputClosed = false
        const exitController = createSessionExitController()
        const cwd = process.cwd()
        const generatedSessionId = opts.sessionId ?? uuid()

        if (opts.spec && opts.entity) {
          throw new Error('--spec and --entity are mutually exclusive.')
        }
        if (opts.inputFormat != null && !opts.print) {
          throw new Error('--input-format is only supported together with --print.')
        }

        const isResume = opts.resume != null
        const outputFormatSource = currentCommand.getOptionValueSource('outputFormat')
        const printSource = currentCommand.getOptionValueSource('print')
        const skills = opts.includeSkill || opts.excludeSkill
          ? {
            include: opts.includeSkill,
            exclude: opts.excludeSkill
          }
          : undefined

        const runTaskOptions = isResume
          ? undefined
          : {
            adapter: opts.adapter,
            cwd,
            ctxId: process.env.__VF_PROJECT_AI_CTX_ID__ ?? generatedSessionId
          }

        const initialResumeRecord = isResume
          ? (() => {
            const disallowedFlags = getDisallowedResumeFlags(opts, currentCommand)
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
              {
                skills,
                adapter: cachedAdapter ?? opts.adapter,
                model: opts.model
              }
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
                currentCommand.getOptionValueSource('injectDefaultSystemPrompt')
              )
            )

            return {
              type: 'create' as const,
              description,
              runtime: 'cli' as const,
              sessionId,
              model: opts.model,
              effort: opts.effort,
              systemPrompt: mergeSystemPrompts({
                generatedSystemPrompt: resolvedConfig.systemPrompt,
                userSystemPrompt: opts.systemPrompt,
                injectDefaultSystemPrompt
              }),
              permissionMode: opts.permissionMode,
              mode: resolveRunMode(
                opts.print,
                printSource,
                'direct'
              ),
              tools: mergeListConfig(
                resolvedConfig.tools,
                opts.includeTool,
                opts.excludeTool
              ),
              mcpServers: mergeListConfig(
                resolvedConfig.mcpServers,
                opts.includeMcpServer,
                opts.excludeMcpServer
              ),
              useDefaultVibeForgeMcpServer: resolveDefaultVibeForgeMcpServerOption(
                opts.defaultVibeForgeMcpServer,
                currentCommand.getOptionValueSource('defaultVibeForgeMcpServer')
              ),
              promptAssetIds: resolvedConfig.promptAssetIds,
              skills,
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
        let stopInputBridge: (() => void) | undefined
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
            const status = persistedDetail?.status === 'stopped' || isCliSessionStopActive(control, endedAt)
              ? 'stopped'
              : exitCode === 0
              ? 'completed'
              : 'failed'
            record.detail = {
              ...record.detail,
              endTime: endedAt,
              exitCode,
              status
            }
            await persistRecord()
            await persistQueue
            await clearCliSessionControl(cwd, ctxId, sessionId)
            stopInputBridge?.()
            if (shouldPrintResumeHint({ shouldPrintOutput, status })) {
              console.error(formatResumeCommand(sessionId))
            }
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
              const nextState = handlePrintEvent({
                event,
                outputFormat,
                lastAssistantText,
                didExitAfterError,
                stopExitsStreamJson: outputFormat === 'stream-json' && opts.inputFormat != null && inputClosed,
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
        if (shouldPrintOutput && opts.inputFormat != null) {
          stopInputBridge = attachInputBridge({
            format: opts.inputFormat,
            session,
            stdin: process.stdin,
            onError: (message) => {
              console.error(message)
              exitController.requestExit(1)
            },
            onInputClosed: () => {
              inputClosed = true
            }
          })
        }
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
