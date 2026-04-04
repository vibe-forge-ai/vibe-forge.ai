import { describe, expect, it } from 'vitest'

import {
  formatToolLabel,
  getSessionAssetWarnings,
  getSessionSelectionWarnings,
  getSessionToolGroups
} from '#~/components/chat/session-metadata'
import type { SessionInfo } from '@vibe-forge/types'

describe('chat session metadata helpers', () => {
  const sessionInfo = {
    type: 'init',
    tools: [
      'mcp__ChromeDevtools__click',
      'Read',
      'mcp__ChromeDevtools__navigate'
    ],
    assetDiagnostics: [
      { assetId: 'alpha', status: 'attached' },
      { assetId: 'beta', status: 'skipped', reason: 'unsupported' }
    ],
    selectionWarnings: [
      {
        adapter: 'claude-code',
        requestedModel: 'foo',
        resolvedModel: 'bar',
        reason: 'excluded'
      }
    ]
  } as unknown as SessionInfo

  it('groups tools by chrome devtools and system buckets', () => {
    expect(getSessionToolGroups(sessionInfo)).toEqual([
      {
        key: 'chrome-devtools',
        labelKey: 'chat.toolGroupChromeDevtools',
        icon: 'web_traffic',
        tools: ['mcp__ChromeDevtools__click', 'mcp__ChromeDevtools__navigate']
      },
      {
        key: 'system',
        labelKey: 'chat.toolGroupSystem',
        icon: 'memory',
        tools: ['Read']
      }
    ])
  })

  it('keeps only skipped asset diagnostics and selection warnings', () => {
    expect(getSessionAssetWarnings(sessionInfo)).toEqual([
      { assetId: 'beta', status: 'skipped', reason: 'unsupported' }
    ])
    expect(getSessionSelectionWarnings(sessionInfo)).toEqual([
      {
        adapter: 'claude-code',
        requestedModel: 'foo',
        resolvedModel: 'bar',
        reason: 'excluded'
      }
    ])
  })

  it('formats tool labels using the terminal segment', () => {
    expect(formatToolLabel('mcp__ChromeDevtools__navigate')).toBe('navigate')
    expect(formatToolLabel('Read')).toBe('Read')
  })
})
