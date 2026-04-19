import { Command } from 'commander'
import process from 'node:process'

import { parseAdapterE2ESelection } from './__tests__/adapter-e2e/cases'
import { runAdapterE2ESuite } from './adapter-e2e/harness'
import { runProcess } from './adapter-e2e/runtime'
import {
  getDefaultChromeDebugPageUrlSubstring,
  parsePositiveIntegerOption,
  runChromeDebugMessengerClickReply,
  runChromeDebugMessengerClickText,
  runChromeDebugMessengerConversations,
  runChromeDebugMessengerSend,
  runChromeDebugTargets
} from './chrome-debug'
import { runHomebrewTapSyncCli } from './homebrew-tap'
import { runMessageActionsVerify } from './message-actions'
import { runWindowsInstallSyncCli } from './windows-install'

const runVitestAdapterE2E = async (input: {
  selection: string | undefined
  updateSnapshots: boolean
  verbose: boolean
}) => {
  const result = await runProcess({
    command: 'pnpm',
    args: [
      'exec',
      'vitest',
      'run',
      '--workspace',
      'vitest.workspace.ts',
      '--project',
      'node',
      'scripts/__tests__/adapter-e2e/adapter-e2e.spec.ts',
      ...(input.updateSnapshots ? ['-u'] : [])
    ],
    env: {
      ...process.env,
      VF_RUN_ADAPTER_E2E: '1',
      VF_ADAPTER_E2E_SELECTION: parseAdapterE2ESelection(input.selection),
      ...(input.verbose ? { VF_E2E_VERBOSE: '1' } : {})
    },
    passthroughStdIO: true
  })

  if (result.code !== 0) {
    process.exitCode = result.code
  }
}

interface ScriptsCliDeps {
  runAdapterSuite: typeof runAdapterE2ESuite
  runAdapterVitest: (input: {
    selection: string | undefined
    updateSnapshots: boolean
    verbose: boolean
  }) => Promise<void>
  runCommitMessageCheck: (input: {
    base?: string
    head?: string
  }) => Promise<void>
  runChromeDebugTargets: typeof runChromeDebugTargets
  runChromeDebugMessengerConversations: typeof runChromeDebugMessengerConversations
  runChromeDebugMessengerSend: typeof runChromeDebugMessengerSend
  runChromeDebugMessengerClickReply: typeof runChromeDebugMessengerClickReply
  runChromeDebugMessengerClickText: typeof runChromeDebugMessengerClickText
  runMessageActionsVerify: typeof runMessageActionsVerify
  runHomebrewTapSyncCli: typeof runHomebrewTapSyncCli
  runWindowsInstallSyncCli: typeof runWindowsInstallSyncCli
  runPublishPlan: (args: string[]) => Promise<unknown>
}

const defaultDeps: ScriptsCliDeps = {
  runAdapterSuite: runAdapterE2ESuite,
  runAdapterVitest: runVitestAdapterE2E,
  runCommitMessageCheck: async (input) => {
    const args = ['scripts/check-commit-messages.mjs']
    if (input.base != null) {
      args.push(input.base)
      args.push(input.head ?? 'HEAD')
    }

    const result = await runProcess({
      command: process.execPath,
      args,
      env: process.env,
      passthroughStdIO: true
    })

    if (result.code !== 0) {
      process.exitCode = result.code
    }
  },
  runChromeDebugTargets,
  runChromeDebugMessengerConversations,
  runChromeDebugMessengerSend,
  runChromeDebugMessengerClickReply,
  runChromeDebugMessengerClickText,
  runMessageActionsVerify,
  runHomebrewTapSyncCli,
  runWindowsInstallSyncCli,
  runPublishPlan: async (args) => {
    const { runPublishPlanCli } = await import('./publish-plan-core.mjs')
    return runPublishPlanCli(args)
  }
}

export const createScriptsCli = (inputDeps: Partial<ScriptsCliDeps> = {}) => {
  const deps: ScriptsCliDeps = {
    ...defaultDeps,
    ...inputDeps
  }
  const program = new Command()

  program
    .name('vf-dev')
    .description('Workspace maintenance commands')

  const adapterE2ECommand = program
    .command('adapter-e2e')
    .description('Run adapter end-to-end verification flows')

  adapterE2ECommand
    .command('run [selection]')
    .description('Run a real offline adapter E2E flow by adapter, case id, or all')
    .option('--quiet', 'Do not stream child CLI output', false)
    .option('--no-summary', 'Disable scenario summary output')
    .action(async (target: string | undefined, options: {
      quiet?: boolean
      summary?: boolean
    }) => {
      await deps.runAdapterSuite(parseAdapterE2ESelection(target), {
        passthroughStdIO: !options.quiet,
        printSummary: options.summary ?? true
      })
    })

  adapterE2ECommand
    .command('test [selection]')
    .description('Run the Vitest adapter E2E suite by adapter, case id, or all')
    .option('--verbose', 'Enable verbose child CLI output', false)
    .option('-u, --update', 'Update Vitest file snapshots', false)
    .action(async (selection: string | undefined, options: {
      update?: boolean
      verbose?: boolean
    }) => {
      await deps.runAdapterVitest({
        selection: parseAdapterE2ESelection(selection),
        updateSnapshots: options.update ?? false,
        verbose: options.verbose ?? false
      })
    })

  const chromeDebugCommand = program
    .command('chrome-debug')
    .description('Inspect and drive a locally running Chrome DevTools target')

  chromeDebugCommand
    .command('targets')
    .description('List Chrome DevTools targets on a local debugging port')
    .option('--port <port>', 'Chrome remote debugging port', value => parsePositiveIntegerOption(value, 'port'), 9222)
    .option('--json', 'Print targets as JSON', false)
    .action(async (options: {
      json?: boolean
      port: number
    }) => {
      await deps.runChromeDebugTargets({
        port: options.port,
        json: options.json ?? false
      })
    })

  chromeDebugCommand
    .command('messenger-conversations')
    .description('List visible Feishu messenger conversations on the current page')
    .option('--port <port>', 'Chrome remote debugging port', value => parsePositiveIntegerOption(value, 'port'), 9222)
    .option(
      '--page-url-substring <substring>',
      'Match the messenger page by URL substring',
      getDefaultChromeDebugPageUrlSubstring()
    )
    .action(async (options: {
      pageUrlSubstring: string
      port: number
    }) => {
      await deps.runChromeDebugMessengerConversations({
        port: options.port,
        pageUrlSubstring: options.pageUrlSubstring
      })
    })

  chromeDebugCommand
    .command('messenger-send <conversation> <message>')
    .description('Open a Feishu messenger conversation and send a message')
    .option('--port <port>', 'Chrome remote debugging port', value => parsePositiveIntegerOption(value, 'port'), 9222)
    .option(
      '--page-url-substring <substring>',
      'Match the messenger page by URL substring',
      getDefaultChromeDebugPageUrlSubstring()
    )
    .option('--replace-draft', 'Replace any existing draft text in the composer', false)
    .option(
      '--settle-ms <ms>',
      'Wait time after clicking send',
      value => parsePositiveIntegerOption(value, 'settle-ms'),
      1500
    )
    .action(async (conversation: string, message: string, options: {
      pageUrlSubstring: string
      port: number
      replaceDraft?: boolean
      settleMs: number
    }) => {
      await deps.runChromeDebugMessengerSend({
        port: options.port,
        pageUrlSubstring: options.pageUrlSubstring,
        conversation,
        message,
        replaceDraft: options.replaceDraft ?? false,
        settleMs: options.settleMs
      })
    })

  chromeDebugCommand
    .command('messenger-click-reply <conversation> <messageSnippet>')
    .description('Hover a Feishu message bubble and click its reply action')
    .option('--port <port>', 'Chrome remote debugging port', value => parsePositiveIntegerOption(value, 'port'), 9222)
    .option(
      '--page-url-substring <substring>',
      'Match the messenger page by URL substring',
      getDefaultChromeDebugPageUrlSubstring()
    )
    .option(
      '--reply-index <index>',
      'Pick the nth visible reply button near the hovered bubble',
      value => parsePositiveIntegerOption(value, 'reply-index'),
      1
    )
    .option(
      '--settle-ms <ms>',
      'Wait time after clicking reply',
      value => parsePositiveIntegerOption(value, 'settle-ms'),
      1000
    )
    .action(async (conversation: string, messageSnippet: string, options: {
      pageUrlSubstring: string
      port: number
      replyIndex: number
      settleMs: number
    }) => {
      await deps.runChromeDebugMessengerClickReply({
        port: options.port,
        pageUrlSubstring: options.pageUrlSubstring,
        conversation,
        messageSnippet,
        replyIndex: options.replyIndex,
        settleMs: options.settleMs
      })
    })

  chromeDebugCommand
    .command('messenger-click-text <conversation> <text>')
    .description('Click a visible messenger UI element by exact text')
    .option('--port <port>', 'Chrome remote debugging port', value => parsePositiveIntegerOption(value, 'port'), 9222)
    .option(
      '--page-url-substring <substring>',
      'Match the messenger page by URL substring',
      getDefaultChromeDebugPageUrlSubstring()
    )
    .option(
      '--settle-ms <ms>',
      'Wait time after clicking the text target',
      value => parsePositiveIntegerOption(value, 'settle-ms'),
      1000
    )
    .action(async (conversation: string, text: string, options: {
      pageUrlSubstring: string
      port: number
      settleMs: number
    }) => {
      await deps.runChromeDebugMessengerClickText({
        port: options.port,
        pageUrlSubstring: options.pageUrlSubstring,
        conversation,
        text,
        settleMs: options.settleMs
      })
    })

  const messageActionsCommand = program
    .command('message-actions')
    .description('Run reusable verification flows for message-level chat actions')

  messageActionsCommand
    .command('verify')
    .description('Run code-quality and regression checks for message edit/recall/fork changes')
    .option('--quiet', 'Do not stream child command output', false)
    .action(async (options: {
      quiet?: boolean
    }) => {
      await deps.runMessageActionsVerify({
        quiet: options.quiet ?? false
      })
    })

  program
    .command('commitmsg-check [base] [head]')
    .description('Validate commit subjects in a git revision range')
    .action(async (base: string | undefined, head: string | undefined) => {
      await deps.runCommitMessageCheck({
        base,
        head
      })
    })

  program
    .command('publish-plan [args...]')
    .allowUnknownOption()
    .description('Run the publish plan tool with passthrough arguments')
    .action(async (args: string[] = []) => {
      await deps.runPublishPlan(args)
    })

  const homebrewTapCommand = program
    .command('homebrew-tap')
    .description('Maintain the Homebrew tap submodule')

  homebrewTapCommand
    .command('sync-cli')
    .requiredOption('--version <version>', 'Published @vibe-forge/cli version to sync')
    .option('--tap-dir <path>', 'Homebrew tap submodule directory', 'infra/homebrew-tap')
    .option('--formula <path>', 'Formula path inside the tap directory', 'Formula/vibe-forge.rb')
    .option('--dry-run', 'Calculate the update without writing the formula', false)
    .description('Update Formula/vibe-forge.rb to the published @vibe-forge/cli tarball')
    .action(async (options: {
      dryRun?: boolean
      formula: string
      tapDir: string
      version: string
    }) => {
      await deps.runHomebrewTapSyncCli({
        version: options.version,
        tapDir: options.tapDir,
        formulaPath: options.formula,
        dryRun: options.dryRun ?? false
      })
    })

  const windowsInstallCommand = program
    .command('windows-install')
    .description('Maintain Windows install metadata')

  windowsInstallCommand
    .command('sync-cli')
    .requiredOption('--version <version>', 'Published @vibe-forge/cli version to sync')
    .option('--scoop-manifest <path>', 'Scoop manifest path', 'infra/windows/scoop-bucket/bucket/vibe-forge.json')
    .option(
      '--winget-version-manifest <path>',
      'Winget version manifest path',
      'infra/windows/winget/VibeForge.VibeForge.yaml'
    )
    .option(
      '--winget-locale-manifest <path>',
      'Winget default locale manifest path',
      'infra/windows/winget/VibeForge.VibeForge.locale.en-US.yaml'
    )
    .option(
      '--winget-template <path>',
      'Winget installer manifest template path',
      'infra/windows/winget/VibeForge.VibeForge.installer.template.yaml'
    )
    .option('--winget-installer-url <url>', 'Windows portable zip URL for winget template')
    .option('--winget-installer-sha256 <sha256>', 'Windows portable zip SHA256 for winget template')
    .option('--dry-run', 'Calculate the update without writing files', false)
    .description('Update Scoop and winget Windows install metadata for the CLI package')
    .action(async (options: {
      dryRun?: boolean
      scoopManifest: string
      version: string
      wingetInstallerSha256?: string
      wingetInstallerUrl?: string
      wingetLocaleManifest: string
      wingetTemplate: string
      wingetVersionManifest: string
    }) => {
      await deps.runWindowsInstallSyncCli({
        version: options.version,
        dryRun: options.dryRun ?? false,
        scoopManifestPath: options.scoopManifest,
        wingetInstallerUrl: options.wingetInstallerUrl,
        wingetInstallerSha256: options.wingetInstallerSha256,
        wingetLocaleManifestPath: options.wingetLocaleManifest,
        wingetVersionManifestPath: options.wingetVersionManifest,
        wingetTemplatePath: options.wingetTemplate
      })
    })

  return program
}

export const runScriptsCli = async (
  argv = process.argv,
  deps: Partial<ScriptsCliDeps> = defaultDeps
) => {
  await createScriptsCli(deps).parseAsync(argv)
}
