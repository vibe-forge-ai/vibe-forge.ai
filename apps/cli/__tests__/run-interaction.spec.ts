import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'

import { resolvePermissionMirrorPath } from '@vibe-forge/utils'
import { describe, expect, it, vi } from 'vitest'

import { getAdapterInteractionMessage, handlePrintEvent, parseCliInputControlEvent } from '#~/commands/run.js'
import { supportsPrintInteractionResponses } from '#~/commands/run/input-control.js'
import { readCliPermissionDecision } from '#~/commands/run/input-decision.js'
import {
  isTerminalPermissionDecision,
  shouldApplyPermissionDecision,
  shouldClearPermissionRecoveryCache
} from '#~/commands/run/permission-decision.js'
import {
  PERMISSION_DECISION_CANCEL,
  buildPermissionRecoveryRecord,
  extractPermissionErrorContext,
  rememberPermissionToolUses
} from '#~/commands/run/permission-recovery.js'
import { applyCliPermissionDecision } from '#~/commands/run/permission-state.js'

describe('run command interaction handling', () => {
  it('formats permission interaction prompts for text output', () => {
    expect(getAdapterInteractionMessage({
      sessionId: 'session-1',
      kind: 'permission',
      question: 'Allow editing files?',
      options: [
        { label: 'Allow once', value: 'allow_once', description: 'Only allow this one call.' },
        { label: 'Deny once', value: 'deny_once' }
      ]
    })).toContain('Allow editing files?')
  })

  it('parses submit_input control input with an optional interaction id', () => {
    expect(parseCliInputControlEvent({
      type: 'submit_input',
      interactionId: 'approval-1',
      data: 'allow_once'
    })).toEqual({
      type: 'submit_input',
      interactionId: 'approval-1',
      data: 'allow_once'
    })
    expect(parseCliInputControlEvent({
      type: 'interaction_response',
      response: ['allow_once']
    })).toEqual({
      type: 'submit_input',
      interactionId: undefined,
      data: ['allow_once']
    })
  })

  it('rejects empty submit_input payloads', () => {
    expect(() => parseCliInputControlEvent({ type: 'submit_input' })).toThrow(
      'Submit input requires a non-empty string or string array in "data" or "response".'
    )
  })

  it('only treats stream-json as a live print interaction input channel', () => {
    expect(supportsPrintInteractionResponses(undefined)).toBe(false)
    expect(supportsPrintInteractionResponses('text')).toBe(false)
    expect(supportsPrintInteractionResponses('json')).toBe(false)
    expect(supportsPrintInteractionResponses('stream-json')).toBe(true)
  })

  it('prints interaction requests and exits text mode when no input channel is available', () => {
    const log = vi.fn()
    const errorLog = vi.fn()
    const requestExit = vi.fn()

    const nextState = handlePrintEvent({
      event: {
        type: 'interaction_request',
        data: {
          id: 'approval-1',
          payload: {
            sessionId: 'session-1',
            kind: 'permission',
            question: 'Allow editing files?',
            options: [
              { label: 'Allow once', value: 'allow_once' }
            ]
          }
        }
      },
      outputFormat: 'text',
      lastAssistantText: 'previous answer',
      didExitAfterError: false,
      exitOnInteractionRequest: true,
      log,
      errorLog,
      requestExit
    })

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('Allow editing files?'))
    expect(requestExit).toHaveBeenCalledWith(1)
    expect(nextState.didExitAfterError).toBe(true)
  })

  it('keeps print mode alive for interaction requests when stdin control is available', () => {
    const log = vi.fn()
    const errorLog = vi.fn()
    const requestExit = vi.fn()

    const nextState = handlePrintEvent({
      event: {
        type: 'interaction_request',
        data: {
          id: 'approval-2',
          payload: {
            sessionId: 'session-1',
            kind: 'permission',
            question: 'Allow bash?',
            options: [
              { label: 'Allow once', value: 'allow_once' }
            ]
          }
        }
      },
      outputFormat: 'stream-json',
      lastAssistantText: undefined,
      didExitAfterError: false,
      exitOnInteractionRequest: false,
      log,
      errorLog,
      requestExit
    })

    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]?.[0]).toContain('"interaction_request"')
    expect(requestExit).not.toHaveBeenCalled()
    expect(nextState.didExitAfterError).toBe(false)
  })

  it('restores claude denied tool subjects from toolUseId-only permission errors', () => {
    const toolUseSubjects = new Map<string, string>()
    rememberPermissionToolUses(toolUseSubjects, {
      id: 'msg-1',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'adapter:claude-code:Write',
          input: { path: 'README.md' }
        }
      ],
      createdAt: Date.now()
    })

    const context = extractPermissionErrorContext({
      code: 'permission_required',
      fatal: true,
      message: 'Permission required to continue',
      details: {
        toolUseId: 'tool-1'
      }
    }, {
      toolUseSubjects
    })
    const record = buildPermissionRecoveryRecord({
      sessionId: 'session-1',
      adapter: 'claude-code',
      currentMode: 'default',
      context
    })

    expect(context.subjectKeys).toEqual(['Write'])
    expect(record?.payload.permissionContext?.subjectKey).toBe('Write')
  })

  it('reads permission decisions from stream-json stdin control', async () => {
    const stdin = new PassThrough()
    const decisionPromise = readCliPermissionDecision({
      format: 'stream-json',
      stdin: stdin as NodeJS.ReadStream
    })

    stdin.end('{"type":"submit_input","data":"allow_once"}\n')

    await expect(decisionPromise).resolves.toBe('allow_once')
  })

  it('keeps pending recovery cache on cancel but clears it for terminal decisions', () => {
    expect(shouldApplyPermissionDecision('allow_session')).toBe(true)
    expect(shouldApplyPermissionDecision('deny_once')).toBe(false)
    expect(shouldClearPermissionRecoveryCache(PERMISSION_DECISION_CANCEL)).toBe(false)
    expect(shouldClearPermissionRecoveryCache('deny_once')).toBe(true)
    expect(isTerminalPermissionDecision('deny_project')).toBe(true)
    expect(isTerminalPermissionDecision('allow_once')).toBe(false)
  })

  it('writes onceAllow decisions into the claude permission mirror', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-cli-permission-'))

    await applyCliPermissionDecision({
      cwd: workspace,
      sessionId: 'session-1',
      adapter: 'claude-code',
      subjectKeys: ['adapter:claude-code:Write'],
      action: 'allow_once'
    })

    const persisted = JSON.parse(
      await readFile(resolvePermissionMirrorPath(workspace, 'claude-code', 'session-1'), 'utf8')
    ) as {
      permissionState?: { onceAllow?: string[] }
    }

    expect(persisted.permissionState?.onceAllow ?? []).toEqual(['Write'])
  })
})
