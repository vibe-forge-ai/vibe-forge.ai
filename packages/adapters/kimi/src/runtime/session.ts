import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

import type {
  AdapterCtx,
  AdapterEvent,
  AdapterOutputEvent,
  AdapterQueryOptions,
  AdapterSession
} from '@vibe-forge/types'

import { normalizePromptContent, toAdapterErrorData } from './common'
import { hasStoredKimiSessionState, resolveKimiSessionBase } from './config'
import { parseKimiOutputLine } from './messages'

export const createKimiSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => {
  const base = await resolveKimiSessionBase(ctx, options)
  let destroyed = false
  let stoppedByUser = false
  let currentPid: number | undefined
  let currentKill: (() => void) | undefined
  let didEmitFatalError = false
  let didEmitExit = false
  let shouldContinue = options.type === 'resume' && hasStoredKimiSessionState(base.shareDir)

  const emitEvent = (event: AdapterOutputEvent) => {
    if (event.type === 'error' && event.data.fatal !== false) {
      didEmitFatalError = true
    }
    options.onEvent(event)
  }
  const emitExit = (data: { exitCode: number; stderr?: string }) => {
    if (didEmitExit) return
    didEmitExit = true
    emitEvent({ type: 'exit', data })
  }

  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model: base.reportedModel ?? base.cliModel ?? options.model ?? 'default',
      effort: options.effort,
      version: 'unknown',
      tools: base.toolNames,
      slashCommands: [],
      cwd: ctx.cwd,
      agents: base.reportedAgent != null ? [base.reportedAgent] : []
    }
  })

  const runTurn = async (prompt: string) => {
    const proc = spawn(base.binaryPath, [
      ...base.turnArgPrefix,
      '--print',
      '--output-format',
      'stream-json',
      ...(options.permissionMode === 'plan' && !shouldContinue ? ['--plan'] : []),
      ...(shouldContinue ? ['--continue'] : []),
      '--prompt',
      prompt
    ], {
      cwd: ctx.cwd,
      env: base.spawnEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    currentPid = proc.pid
    currentKill = () => proc.kill('SIGINT')
    let stderr = ''
    let lastMessage: ReturnType<typeof parseKimiOutputLine> | undefined

    const lines = createInterface({ input: proc.stdout })
    lines.on('line', (line) => {
      const message = parseKimiOutputLine(line, base.reportedModel ?? base.cliModel)
      if (message == null) return
      lastMessage = message
      emitEvent({ type: 'message', data: message })
    })
    proc.stderr.on('data', chunk => {
      stderr += String(chunk)
    })

    const exitCode = await new Promise<number>((resolve, reject) => {
      proc.once('error', reject)
      proc.once('close', code => resolve(code ?? 0))
    })

    currentPid = undefined
    currentKill = undefined
    lines.close()

    if (destroyed && stoppedByUser) {
      emitExit({ exitCode: 0 })
      return
    }

    if (exitCode !== 0) {
      if (!didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: toAdapterErrorData(stderr || `Process exited with code ${exitCode}`, {
            details: { exitCode, stderr }
          })
        })
      }
      emitExit({ exitCode, stderr })
      destroyed = true
      return
    }

    shouldContinue = true
    emitEvent(lastMessage == null ? { type: 'stop' } : { type: 'stop', data: lastMessage })
  }

  let queue = Promise.resolve()
  const enqueueMessage = (event: Extract<AdapterEvent, { type: 'message' }>) => {
    const prompt = normalizePromptContent(event.content)
    if (prompt == null || prompt.trim() === '') return

    queue = queue
      .catch(() => undefined)
      .then(async () => {
        if (destroyed) return
        try {
          await runTurn(prompt)
        } catch (error) {
          if (destroyed && stoppedByUser) {
            emitExit({ exitCode: 0 })
            return
          }
          emitEvent({ type: 'error', data: toAdapterErrorData(error) })
          emitExit({ exitCode: 1, stderr: error instanceof Error ? error.message : String(error) })
          destroyed = true
        }
      })
  }

  if (options.description != null && options.description.trim() !== '') {
    enqueueMessage({ type: 'message', content: [{ type: 'text', text: options.description.trim() }] })
  }

  return {
    kill: () => {
      destroyed = true
      stoppedByUser = true
      currentKill?.()
      if (currentPid == null) {
        emitExit({ exitCode: 0 })
      }
    },
    stop: () => {
      destroyed = true
      stoppedByUser = true
      currentKill?.()
      if (currentPid == null) {
        emitExit({ exitCode: 0 })
      }
    },
    emit: (event) => {
      if (destroyed) return
      if (event.type === 'message') enqueueMessage(event)
      if (event.type === 'interrupt') currentKill?.()
      if (event.type === 'stop') {
        destroyed = true
        stoppedByUser = true
        currentKill?.()
        if (currentPid == null) {
          emitExit({ exitCode: 0 })
        }
      }
    },
    get pid() {
      return currentPid
    }
  }
}
