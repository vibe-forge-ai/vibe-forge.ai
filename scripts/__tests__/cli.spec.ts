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
      runMessageActionsVerify: vi.fn(async () => {}),
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
      runMessageActionsVerify: vi.fn(async () => {}),
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
      runMessageActionsVerify: vi.fn(async () => {}),
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
      runMessageActionsVerify: vi.fn(async () => {}),
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
      runMessageActionsVerify: vi.fn(async () => {}),
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
      runMessageActionsVerify: vi.fn(async () => {}),
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
      runMessageActionsVerify: vi.fn(async () => {}),
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
      runMessageActionsVerify: vi.fn(async () => {}),
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

  it('dispatches message actions verification with quiet mode', async () => {
    const runMessageActionsVerify = vi.fn(async () => {})
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runMessageActionsVerify,
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync(['node', 'vf-dev', 'message-actions', 'verify', '--quiet'])

    expect(runMessageActionsVerify).toHaveBeenCalledWith({
      quiet: true
    })
  })

  it('dispatches homebrew tap CLI formula sync', async () => {
    const runHomebrewTapSyncCli = vi.fn(async () => ({
      formulaPath: '/repo/infra/homebrew-tap/Formula/vibe-forge.rb',
      sha256: '0'.repeat(64),
      tarballUrl: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz',
      written: true
    }))
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runMessageActionsVerify: vi.fn(async () => {}),
      runHomebrewTapSyncCli,
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'homebrew-tap',
      'sync-cli',
      '--version',
      '1.2.3',
      '--tap-dir',
      'infra/homebrew-tap',
      '--dry-run'
    ])

    expect(runHomebrewTapSyncCli).toHaveBeenCalledWith({
      version: '1.2.3',
      tapDir: 'infra/homebrew-tap',
      formulaPath: 'Formula/vibe-forge.rb',
      dryRun: true
    })
  })

  it('dispatches homebrew tap bootstrap formula sync', async () => {
    const runHomebrewTapSyncBootstrap = vi.fn(async () => ({
      formulaPath: '/repo/infra/homebrew-tap/Formula/vibe-forge-bootstrap.rb',
      sha256: '0'.repeat(64),
      tarballUrl: 'https://registry.npmjs.org/@vibe-forge/bootstrap/-/bootstrap-1.0.0.tgz',
      written: true
    }))
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runMessageActionsVerify: vi.fn(async () => {}),
      runHomebrewTapSyncBootstrap,
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'homebrew-tap',
      'sync-bootstrap',
      '--version',
      '1.0.0',
      '--dry-run'
    ])

    expect(runHomebrewTapSyncBootstrap).toHaveBeenCalledWith({
      version: '1.0.0',
      tapDir: 'infra/homebrew-tap',
      formulaPath: 'Formula/vibe-forge-bootstrap.rb',
      dryRun: true
    })
  })

  it('dispatches Windows install metadata sync', async () => {
    const runWindowsInstallSyncCli = vi.fn(async () => ({
      scoopManifestPath: '/repo/infra/windows/scoop-bucket/bucket/vibe-forge.json',
      sha256: '0'.repeat(64),
      tarballUrl: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz',
      wingetInstallerUrl: 'https://example.com/vibe-forge-cli-windows-1.2.3.zip',
      wingetLocaleManifestPath: '/repo/infra/windows/winget/VibeForge.VibeForge.locale.en-US.yaml',
      wingetTemplatePath: '/repo/infra/windows/winget/VibeForge.VibeForge.installer.template.yaml',
      wingetVersionManifestPath: '/repo/infra/windows/winget/VibeForge.VibeForge.yaml',
      written: true
    }))
    const cli = createScriptsCli({
      runAdapterSuite: vi.fn(async () => []),
      runAdapterVitest: vi.fn(async () => {}),
      runChromeDebugTargets: vi.fn(async () => {}),
      runChromeDebugMessengerConversations: vi.fn(async () => {}),
      runChromeDebugMessengerSend: vi.fn(async () => {}),
      runChromeDebugMessengerClickReply: vi.fn(async () => {}),
      runChromeDebugMessengerClickText: vi.fn(async () => {}),
      runMessageActionsVerify: vi.fn(async () => {}),
      runWindowsInstallSyncCli,
      runPublishPlan: vi.fn(async () => ({}))
    })

    await cli.parseAsync([
      'node',
      'vf-dev',
      'windows-install',
      'sync-cli',
      '--version',
      '1.2.3',
      '--winget-installer-url',
      'https://example.com/vibe-forge-cli-windows-1.2.3.zip',
      '--dry-run'
    ])

    expect(runWindowsInstallSyncCli).toHaveBeenCalledWith({
      version: '1.2.3',
      dryRun: true,
      scoopManifestPath: 'infra/windows/scoop-bucket/bucket/vibe-forge.json',
      wingetInstallerUrl: 'https://example.com/vibe-forge-cli-windows-1.2.3.zip',
      wingetInstallerSha256: undefined,
      wingetLocaleManifestPath: 'infra/windows/winget/VibeForge.VibeForge.locale.en-US.yaml',
      wingetVersionManifestPath: 'infra/windows/winget/VibeForge.VibeForge.yaml',
      wingetTemplatePath: 'infra/windows/winget/VibeForge.VibeForge.installer.template.yaml'
    })
  })
})
