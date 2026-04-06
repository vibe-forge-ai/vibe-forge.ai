import { describe, expect, it } from 'vitest'

import { buildCodexApprovalResponse, resolveCodexApprovalDecision } from '#~/runtime/stream.js'

describe('codex stream approval decision mapping', () => {
  it('maps file-change cancel responses to decline', () => {
    expect(resolveCodexApprovalDecision({
      answer: 'cancel',
      kind: 'file-change'
    })).toBe('decline')
  })

  it('preserves command cancel responses when supported', () => {
    expect(resolveCodexApprovalDecision({
      answer: 'cancel',
      kind: 'command',
      availableDecisions: ['accept', 'cancel', 'decline']
    })).toBe('cancel')
  })

  it('wraps file-change approvals in the schema response envelope', () => {
    expect(buildCodexApprovalResponse({
      answer: 'allow_once',
      kind: 'file-change'
    })).toEqual({ decision: 'accept' })
  })

  it('wraps session approvals in the schema response envelope', () => {
    expect(buildCodexApprovalResponse({
      answer: 'allow_session',
      kind: 'command',
      availableDecisions: ['accept', 'acceptForSession', 'decline']
    })).toEqual({ decision: 'acceptForSession' })
  })
})
