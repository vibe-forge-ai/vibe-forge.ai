import process from 'node:process'

import { Option } from 'commander'
import type { Command } from 'commander'

import { generateAdapterQueryOptions, run } from '@vibe-forge/app-runtime'
import { loadInjectDefaultSystemPromptValue, mergeSystemPrompts } from '@vibe-forge/config'
import { callHook } from '@vibe-forge/hooks'
import type { AdapterInteractionRequest, AdapterOutputEvent, SessionInitInfo } from '@vibe-forge/types'
import { getCache } from '@vibe-forge/utils/cache'
import { resolveProjectPrimaryWorkspaceFolder } from '@vibe-forge/utils/project-cache-path'
import { uuid } from '@vibe-forge/utils/uuid'

import { getCliDefaultSkillNames, getCliDefaultSkillPluginConfig } from '#~/default-skill-plugin.js'
import {
  clearCliSessionControl,
  formatResumeCommand,
  isCliSessionStopActive,
  readCliSessionControl,
  resolveCliSession,
  resolveCliSessionAdapter,
  writeCliSessionRecord
} from '#~/session-cache.js'
import {
  clearCliSessionPermissionRecovery,
  readCliSessionPermissionRecovery,
  writeCliSessionPermissionRecovery
} from '#~/session-permission-cache.js'
import { resolveCliWorkspaceCwd } from '#~/workspace.js'
import { createAdapterOption } from '../@core/adapter-option'
import { extraOptions } from '../@core/extra-options'
import { attachInputBridge } from './input-bridge'
import { supportsPrintInteractionResponses } from './input-control'
import { readCliPermissionDecision } from './input-decision'
import {
  getDisallowedResumeFlags,
  getOutputFormat,
  mergeListConfig,
  resolveDefaultVibeForgeMcpServerOption,
  resolveInjectDefaultSystemPromptOption,
  resolveResumeAdapterOptions,
  resolveRunMode
} from './options'
import { getAdapterInteractionMessage, handlePrintEvent, shouldPrintResumeHint } from './output'
import {
  isTerminalPermissionDecision,
  shouldApplyPermissionDecision,
  shouldClearPermissionRecoveryCache
} from './permission-decision'
import {
  PERMISSION_DECISION_CANCEL,
  PERMISSION_RECOVERY_CONTINUE_PROMPT,
  buildPermissionRecoveryRecord,
  extractPermissionErrorContext,
  rememberPermissionToolUses,
  resolvePermissionInteractionDecision
} from './permission-recovery'
import { applyCliPermissionDecision } from './permission-state'
import { createSessionExitController } from './session-exit-controller'
import type { ActiveCliSessionRecord, ExitControllableSession, RunOptions } from './types'
import { RUN_INPUT_FORMATS, RUN_OUTPUT_FORMATS } from './types'

type PrintInputCapableSession = ExitControllableSession & {
  pid?: number
  respondInteraction?: (id: string, data: string | string[]) => void | Promise<void>
}

const resolveRunPrimaryWorkspaceFolder = (
  workspaceFolder: string,
  fallbackWorkspaceFolder: string
) => resolveProjectPrimaryWorkspaceFolder(workspaceFolder, process.env) ?? fallbackWorkspaceFolder

const configureRunCommand = (command: Command) => {
  command
    .argument('[description...]')
    .option('--print', 'Print assistant output to stdout', false)
    .option('--model <model>', 'Model to use')
    .option('--effort <effort>', 'Effort to use (low, medium, high, max)')
    .addOption(createAdapterOption('Adapter to use'))
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
    .option('--workspace <workspace>', 'Run in a configured workspace')
    .option('--include-mcp-server <server...>', 'Include MCP server')
    .option('--exclude-mcp-server <server...>', 'Exclude MCP server')
    .option('--no-default-vibe-forge-mcp-server', 'Do not enable the built-in Vibe Forge MCP server')
    .option('--include-tool <tool...>', 'Include tool')
    .option('--exclude-tool <tool...>', 'Exclude tool')
    .option('--include-skill <skill...>', 'Include skill')
    .option('--exclude-skill <skill...>', 'Exclude skill')
    .option('--update-skills', 'Update configured project skills before session startup', false)
    .addHelpText(
      'after',
      `
Examples:
  vf "实现一个新的 list 筛选"
  vf run -A codex --print "读取 README 并总结"
  vf run -A claude "读取 README 并总结"
  vf run --workspace billing "修复订单状态回滚问题"
  vf run --include-skill vf-cli-quickstart "介绍一下 vf CLI 怎么恢复会话"
  vf "帮我创建一个前端评审实体"
  vf "给 frontend-reviewer 加上移动端布局记忆"
  vf list --view default
  vf --resume <sessionId>

Notes:
  --adapter also supports -A and simplified ids like claude / adapter-codex.
  When using --resume, startup-only flags like --adapter, --system-prompt, --spec and --workspace are loaded from cache and cannot be set again.
  --permission-mode is the exception: it overrides the cached permission mode for the resumed run and is saved for later resumes.
  Resume still allows overriding --model, --effort, --include-tool and --exclude-tool for the next turn.
  The resolved adapter is pinned in cache, so later default adapter changes do not affect resume.
  Default CLI skills shipped via @vibe-forge/plugin-cli-skills: ${getCliDefaultSkillNames().join(', ')}.
  In print mode, live permission/input replies require --input-format stream-json, then send {"type":"submit_input","data":"allow_once"}.
`
    )
    .action(async (descriptionArgs: string[], opts: RunOptions, currentCommand: Command) => {
      try {
        const description = descriptionArgs.join(' ')
        let lastAssistantText: string | undefined
        let didExitAfterError = false
        let inputClosed = false
        let pendingInteraction: AdapterInteractionRequest | undefined
        const exitController = createSessionExitController()
        const cwd = resolveCliWorkspaceCwd()
        const generatedSessionId = opts.sessionId ?? uuid()

        const selectedTargetFlags = [opts.spec, opts.entity, opts.workspace].filter(
          (value): value is string => value != null && value.trim() !== ''
        )
        if (selectedTargetFlags.length > 1) {
          throw new Error('--spec, --entity and --workspace are mutually exclusive.')
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

        const createCtxId = process.env.__VF_PROJECT_AI_CTX_ID__ ?? generatedSessionId

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
        let resolvedTaskCwd = cachedSession?.resume?.taskOptions.cwd ?? cwd
        const cachedAdapter = cachedSession == null
          ? undefined
          : (resolveCliSessionAdapter(cachedSession) || undefined)
        const sessionId = cachedSession?.resume?.sessionId ?? generatedSessionId
        const ctxId = cachedSession?.resume?.ctxId ?? createCtxId ?? sessionId
        const outputFormat = getOutputFormat(
          opts.outputFormat,
          outputFormatSource,
          cachedSession?.resume?.outputFormat ?? 'text'
        )
        const resumeMode = resolveRunMode(
          opts.print,
          printSource,
          cachedSession?.resume?.adapterOptions.mode ?? 'direct'
        )
        const shouldPrintOutput = resumeMode === 'stream'
        const supportsPrintInteractionInput = supportsPrintInteractionResponses(opts.inputFormat)
        const pendingPermissionRecovery = await readCliSessionPermissionRecovery(cwd, ctxId, sessionId)
        const cachedResumePermissionMode = cachedSession?.resume?.adapterOptions.permissionMode
        const resolvedResumePermissionMode = isResume
          ? (opts.permissionMode ?? cachedResumePermissionMode)
          : opts.permissionMode
        const permissionRecoveryMode = pendingPermissionRecovery?.permissionMode ?? cachedResumePermissionMode
        const resumePermissionModeChanged = isResume &&
          opts.permissionMode != null &&
          opts.permissionMode !== permissionRecoveryMode
        const activePermissionRecovery = resumePermissionModeChanged ? undefined : pendingPermissionRecovery

        if (resumePermissionModeChanged && pendingPermissionRecovery != null) {
          await clearCliSessionPermissionRecovery(cwd, ctxId, sessionId)
        } else if (isResume && activePermissionRecovery != null) {
          if (shouldPrintOutput) {
            handlePrintEvent({
              event: {
                type: 'interaction_request',
                data: {
                  id: `cli-recovery:${sessionId}`,
                  payload: activePermissionRecovery.payload
                }
              },
              outputFormat,
              lastAssistantText,
              didExitAfterError,
              exitOnInteractionRequest: false,
              log: (message) => console.log(message),
              errorLog: (message) => console.error(message),
              requestExit: () => {}
            })
          } else {
            console.error(getAdapterInteractionMessage(activePermissionRecovery.payload))
          }

          if (opts.inputFormat == null) {
            console.error(
              `Resume with --print --input-format to answer this permission request for session ${sessionId}.`
            )
            process.exit(1)
          }

          const answer = await readCliPermissionDecision({
            format: opts.inputFormat,
            stdin: process.stdin
          })
          const decision = resolvePermissionInteractionDecision(answer)
          if (decision == null) {
            throw new TypeError('Permission recovery requires a decision like allow_once or deny_project.')
          }

          if (decision === PERMISSION_DECISION_CANCEL) {
            console.error('Permission recovery cancelled. Session was not resumed.')
            process.exit(1)
          }
          if (shouldApplyPermissionDecision(decision)) {
            await applyCliPermissionDecision({
              cwd: resolvedTaskCwd,
              sessionId,
              adapter: activePermissionRecovery.adapter,
              subjectKeys: activePermissionRecovery.subjectKeys,
              action: decision
            })
          }
          if (shouldClearPermissionRecoveryCache(decision)) {
            await clearCliSessionPermissionRecovery(cwd, ctxId, sessionId)
          }
          if (isTerminalPermissionDecision(decision)) {
            console.error(`Permission decision applied: ${decision}. Session was not resumed.`)
            process.exit(1)
          }
        }

        const adapterOptions = cachedSession?.resume != null
          ? {
            ...resolveResumeAdapterOptions(cachedSession.resume.adapterOptions, opts),
            type: 'resume' as const,
            description: activePermissionRecovery == null
              ? description
              : (description.trim() === ''
                ? PERMISSION_RECOVERY_CONTINUE_PROMPT
                : `${PERMISSION_RECOVERY_CONTINUE_PROMPT}\n\n${description}`),
            permissionMode: resolvedResumePermissionMode,
            mode: resumeMode,
            extraOptions
          }
          : await (async () => {
            const promptType = opts.workspace
              ? 'workspace'
              : (opts.spec ? 'spec' : (opts.entity ? 'entity' : undefined))
            const promptName = opts.workspace || opts.spec || opts.entity
            const [data, resolvedConfig] = await generateAdapterQueryOptions(
              promptType,
              promptName,
              cwd,
              {
                skills,
                adapter: cachedAdapter ?? opts.adapter,
                model: opts.model,
                plugins: getCliDefaultSkillPluginConfig(),
                updateConfiguredSkills: opts.updateSkills === true
              }
            )
            resolvedTaskCwd = resolvedConfig.workspace?.cwd ?? cwd
            const env = {
              ...process.env,
              __VF_PROJECT_AI_CTX_ID__: ctxId,
              __VF_PROJECT_WORKSPACE_FOLDER__: resolvedTaskCwd,
              __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: resolveRunPrimaryWorkspaceFolder(resolvedTaskCwd, cwd)
            }
            await callHook('GenerateSystemPrompt', {
              cwd: resolvedTaskCwd,
              sessionId,
              type: promptType,
              name: promptName,
              data
            }, env)

            const injectDefaultSystemPrompt = await loadInjectDefaultSystemPromptValue(
              resolvedTaskCwd,
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
        const {
          type: _adapterType,
          description: _adapterDescription,
          ...cachedAdapterOptions
        } = adapterOptions
        const runTaskOptions = isResume
          ? undefined
          : {
            adapter: opts.adapter,
            cwd: resolvedTaskCwd,
            ctxId
          }

        const record: ActiveCliSessionRecord = {
          resume: {
            version: 1 as const,
            ctxId,
            sessionId,
            cwd: cachedSession?.resume?.cwd ?? resolvedTaskCwd,
            description: description || cachedSession?.resume?.description,
            createdAt: cachedSession?.resume?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
            resolvedAdapter: cachedSession?.resume?.resolvedAdapter ?? cachedAdapter,
            taskOptions: {
              ...(cachedSession?.resume?.taskOptions ?? {
                cwd: resolvedTaskCwd,
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
            model: adapterOptions.model ?? cachedSession?.detail?.model ?? cachedSession?.resume?.adapterOptions.model
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

        let boundSession: PrintInputCapableSession | undefined
        let stopInputBridge: (() => void) | undefined
        const permissionToolUseCache = new Map<string, string>()
        let permissionRecoveryQueue: Promise<void> = Promise.resolve()
        const submitPrintInput = async (params: { interactionId?: string; data: string | string[] }) => {
          const interactionId = params.interactionId ?? pendingInteraction?.id
          if (interactionId == null || interactionId.trim() === '') {
            throw new TypeError('No pending interaction is available. Wait for an interaction_request event first.')
          }
          const respondInteraction = boundSession?.respondInteraction
          if (typeof respondInteraction !== 'function') {
            throw new TypeError('The current session does not support submit_input events.')
          }

          await respondInteraction(interactionId, params.data)

          if (pendingInteraction?.id === interactionId) {
            pendingInteraction = undefined
          }
        }
        const handleExit = (exitCode: number) => {
          void (async () => {
            const endedAt = Date.now()
            const [persistedDetail, control] = await Promise.all([
              getCache(record.resume.taskOptions.cwd ?? record.resume.cwd, ctxId, sessionId, 'detail'),
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
            await permissionRecoveryQueue
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
          updateConfiguredSkills: opts.updateSkills === true,
          env: {
            ...process.env,
            __VF_PROJECT_WORKSPACE_FOLDER__: record.resume.taskOptions.cwd ?? record.resume.cwd,
            __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: resolveRunPrimaryWorkspaceFolder(
              record.resume.taskOptions.cwd ?? record.resume.cwd,
              cwd
            )
          },
          plugins: getCliDefaultSkillPluginConfig()
        }, {
          ...adapterOptions,
          onEvent: (event: AdapterOutputEvent) => {
            if (event.type === 'init') {
              updateInitRecord(event.data, boundSession?.pid)
            }
            if (event.type === 'message') {
              rememberPermissionToolUses(permissionToolUseCache, event.data)
            }
            if (event.type === 'error' && event.data.code === 'permission_required') {
              const permissionRecovery = buildPermissionRecoveryRecord({
                sessionId,
                adapter: resolvedAdapter ?? record.resume.resolvedAdapter ?? record.resume.taskOptions.adapter,
                currentMode: record.resume.adapterOptions.permissionMode,
                context: extractPermissionErrorContext(event.data, {
                  toolUseSubjects: permissionToolUseCache
                })
              })
              if (permissionRecovery != null) {
                permissionRecoveryQueue = permissionRecoveryQueue
                  .catch(() => {})
                  .then(async () => {
                    await writeCliSessionPermissionRecovery(cwd, ctxId, sessionId, permissionRecovery)
                  })
                if (shouldPrintOutput) {
                  const nextState = handlePrintEvent({
                    event: {
                      type: 'interaction_request',
                      data: {
                        id: `cli-recovery:${sessionId}`,
                        payload: permissionRecovery.payload
                      }
                    },
                    outputFormat,
                    lastAssistantText,
                    didExitAfterError,
                    exitOnInteractionRequest: true,
                    log: (message) => console.log(message),
                    errorLog: (message) => console.error(message),
                    requestExit: (code) => exitController.requestExit(code)
                  })
                  lastAssistantText = nextState.lastAssistantText
                  didExitAfterError = nextState.didExitAfterError
                }
                return
              }
            }
            if (event.type === 'interaction_request') {
              pendingInteraction = event.data
              if (shouldPrintOutput && opts.inputFormat != null && !supportsPrintInteractionInput) {
                console.error(
                  'Print-mode interaction responses require --input-format stream-json. Exiting after printing the request.'
                )
              }
            }
            if (
              event.type === 'stop' ||
              event.type === 'exit' ||
              (event.type === 'error' && event.data.fatal !== false)
            ) {
              pendingInteraction = undefined
            }
            if (shouldPrintOutput) {
              const nextState = handlePrintEvent({
                event,
                outputFormat,
                lastAssistantText,
                didExitAfterError,
                exitOnInteractionRequest: event.type === 'interaction_request' && (
                  !supportsPrintInteractionInput || inputClosed
                ),
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
              if (pendingInteraction != null) {
                exitController.requestExit(1)
              }
            },
            submitInput: submitPrintInput
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
