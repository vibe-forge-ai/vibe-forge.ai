import { Command } from 'commander'
import process from 'node:process'

import { runProcess } from './adapter-e2e/runtime'
import { runAdapterE2ESuite } from './adapter-e2e/harness'
import { parseAdapterE2ESelection } from './__tests__/adapter-e2e/cases'

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
  runPublishPlan: (args: string[]) => Promise<unknown>
}

const defaultDeps: ScriptsCliDeps = {
  runAdapterSuite: runAdapterE2ESuite,
  runAdapterVitest: runVitestAdapterE2E,
  runPublishPlan: async (args) => {
    const { runPublishPlanCli } = await import('./publish-plan-core.mjs')
    return runPublishPlanCli(args)
  }
}

export const createScriptsCli = (deps: ScriptsCliDeps = defaultDeps) => {
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

  program
    .command('publish-plan [args...]')
    .allowUnknownOption()
    .description('Run the publish plan tool with passthrough arguments')
    .action(async (args: string[] = []) => {
      await deps.runPublishPlan(args)
    })

  return program
}

export const runScriptsCli = async (
  argv = process.argv,
  deps: ScriptsCliDeps = defaultDeps
) => {
  await createScriptsCli(deps).parseAsync(argv)
}
