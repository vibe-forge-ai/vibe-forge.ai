import { describe, expect, it } from 'vitest'

import { formatCodexCommandForDisplay } from '#~/command-display.js'
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

describe('formatCodexCommandForDisplay', () => {
  it('formats array commands', () => {
    expect(formatCodexCommandForDisplay(['/usr/bin/zsh', '-lc', 'ls -la'])).toBe('/usr/bin/zsh -lc ls -la')
  })

  it('preserves string commands', () => {
    expect(formatCodexCommandForDisplay('/usr/bin/zsh -lc ls -la')).toBe('/usr/bin/zsh -lc ls -la')
  })

  it('formats structured commands without throwing', () => {
    expect(formatCodexCommandForDisplay({
      executable: '/usr/bin/zsh',
      args: ['-lc', 'ls -la']
    })).toBe('/usr/bin/zsh -lc ls -la')
  })

  it('falls back to a placeholder when command is empty', () => {
    expect(formatCodexCommandForDisplay(undefined)).toBe('[command]')
    expect(formatCodexCommandForDisplay({})).toBe('[command]')
  })
})
