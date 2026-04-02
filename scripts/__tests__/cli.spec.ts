import { describe, expect, it, vi } from 'vitest'

import { createScriptsCli } from '../cli'

describe('scripts cli', () => {
  it('dispatches adapter e2e run through the shared suite', async () => {
    const runAdapterSuite = vi.fn(async () => [])
    const cli = createScriptsCli({
      runAdapterSuite,
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync(['node', 'vf-dev', 'adapter-e2e', 'run', 'codex', '--quiet'])

    expect(runAdapterSuite).toHaveBeenCalledWith('codex', {
      passthroughStdIO: false,
      printSummary: true
    })
  })

  it('dispatches adapter e2e test with verbose mode', async () => {
    const runAdapterVitest = vi.fn(async () => {})
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest,
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'adapter-e2e',
      'test',
      'codex-read-once',
      '--verbose',
      '--update'
    ])

    expect(runAdapterVitest).toHaveBeenCalledWith({
      selection: 'codex-read-once',
      updateSnapshots: true,
      verbose: true
    })
  })

  it('passes through publish plan arguments after --', async () => {
    const runPublishPlan = vi.fn(async () => ({}))
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runPublishPlan
    })

    await cli.parseAsync(['node', 'vf-dev', 'publish-plan', '--', '--publish', '--tag', 'next'])

    expect(runPublishPlan).toHaveBeenCalledWith(['--publish', '--tag', 'next'])
  })

  it('dispatches chrome debug targets with parsed options', async () => {
    const runChromeDebugTargets = vi.fn(async () => {})
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets,
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync(['node', 'vf-dev', 'chrome-debug', 'targets', '--port', '9333', '--json'])

    expect(runChromeDebugTargets).toHaveBeenCalledWith({
      port: 9333,
      json: true
    })
  })

  it('dispatches chrome debug messenger send with defaults', async () => {
    const runChromeDebugMessengerSend = vi.fn(async () => {})
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend,
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'chrome-debug',
      'messenger-send',
      '二介',
      '/reset',
      '--replace-draft',
      '--settle-ms',
      '2500'
    ])

    expect(runChromeDebugMessengerSend).toHaveBeenCalledWith({
      port: 9222,
      pageUrlSubstring: '/next/messenger',
      conversation: '二介',
      message: '/reset',
      replaceDraft: true,
      settleMs: 2500
    })
  })

  it('dispatches chrome debug messenger conversation listing with defaults', async () => {
    const runChromeDebugMessengerConversations = vi.fn(async () => {})
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations,
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'chrome-debug',
      'messenger-conversations'
    ])

    expect(runChromeDebugMessengerConversations).toHaveBeenCalledWith({
      port: 9222,
      pageUrlSubstring: '/next/messenger'
    })
  })

  it('dispatches chrome debug messenger reply clicks with defaults', async () => {
    const runChromeDebugMessengerClickReply = vi.fn(async () => {})
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply,
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'chrome-debug',
      'messenger-click-reply',
      '二介',
      '支持的指令：',
      '--reply-index',
      '2'
    ])

    expect(runChromeDebugMessengerClickReply).toHaveBeenCalledWith({
      port: 9222,
      pageUrlSubstring: '/next/messenger',
      conversation: '二介',
      messageSnippet: '支持的指令：',
      replyIndex: 2,
      settleMs: 1000
    })
  })

  it('dispatches chrome debug messenger text clicks with defaults', async () => {
    const runChromeDebugMessengerClickText = vi.fn(async () => {})
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText,
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'chrome-debug',
      'messenger-click-text',
      '二介',
      '/help --page=2'
    ])

    expect(runChromeDebugMessengerClickText).toHaveBeenCalledWith({
      port: 9222,
      pageUrlSubstring: '/next/messenger',
      conversation: '二介',
      text: '/help --page=2',
      settleMs: 1000
    })
  })
})
