import process from 'node:process'

import type { Command } from 'commander'
import { Option } from 'commander'

import type { AdapterPrepareCommandOptions } from './adapter/prepare'
import { runAdapterPrepareCommand } from './adapter/prepare'

const formatErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

export { resolveAdapterPrepareRequests } from './adapter/prepare'

export function registerAdapterCommand(program: Command) {
  const adapterCommand = program
    .command('adapter')
    .description('Manage adapter runtime resources')

  adapterCommand
    .command('prepare [targets...]')
    .description('Preinstall managed adapter CLI resources into the workspace cache')
    .option('--all', 'Prepare all known adapter CLI resources', false)
    .option('--json', 'Print JSON output', false)
    .option('--quiet', 'Suppress non-error output', false)
    .addOption(new Option('--from-postinstall', 'Mark this run as a package postinstall prewarm').hideHelp())
    .addHelpText(
      'after',
      `
Examples:
  vf adapter prepare
  vf adapter prepare --all
  vf adapter prepare codex claude-code gemini
  vf adapter prepare claude-code.routerCli
`
    )
    .action(async (targets: string[], opts: AdapterPrepareCommandOptions) => {
      try {
        await runAdapterPrepareCommand(targets, opts)
      } catch (error) {
        const message = formatErrorMessage(error)
        if (opts.json === true) {
          console.error(JSON.stringify({ ok: false, error: message }, null, 2))
        } else {
          console.error(message)
        }
        process.exit(1)
      }
    })
}
