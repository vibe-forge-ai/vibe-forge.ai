import type { Command } from 'commander'

import { publishSkillsCli, resolveProjectSkillPublishSpec, resolveSkillsCliRuntimeConfig } from '@vibe-forge/utils'

import { resolveCliWorkspaceCwd } from '#~/workspace.js'

import { exitWithError, loadSkillsConfigState, printResult } from './shared'
import type { SkillsPublishOptions } from './types'

export const registerPublishSkillSubcommand = (skillsCommand: Command) => {
  skillsCommand
    .command('publish <skill>')
    .description('Publish a local project skill, local path, or remote skill spec through the configured skills CLI')
    .option('--access <access>', 'Publish access level passed to the skills CLI')
    .option('--group [name]', 'Publish to a specific group; pass bare --group to select interactively')
    .option('--region <region>', 'Publish region passed to the skills CLI')
    .option('--registry <registry>', 'Package registry used to install the managed skills CLI')
    .option('-y, --yes', 'Skip confirmation prompts when the underlying skills CLI supports it', false)
    .option('--json', 'Print JSON output', false)
    .action(async (skill: string, opts: SkillsPublishOptions) => {
      try {
        const workspaceFolder = resolveCliWorkspaceCwd()
        const state = await loadSkillsConfigState(workspaceFolder)
        const resolved = await resolveProjectSkillPublishSpec({
          selector: skill,
          workspaceFolder
        })
        const published = await publishSkillsCli({
          access: opts.access,
          config: resolveSkillsCliRuntimeConfig(state.mergedConfig),
          cwd: workspaceFolder,
          group: opts.group,
          region: opts.region,
          registry: opts.registry,
          skillSpec: resolved.skillSpec,
          yes: opts.yes
        })

        if (opts.json) {
          printResult({
            action: 'publish',
            output: published.output,
            requested: resolved.requested,
            skillSpec: resolved.skillSpec,
            source: resolved.kind,
            workspaceFolder
          }, true)
          return
        }

        const output = published.output.trim()
        if (output !== '') {
          console.log(output)
          return
        }

        printResult({
          action: 'publish',
          requested: resolved.requested,
          skillSpec: resolved.skillSpec,
          source: resolved.kind,
          workspaceFolder
        })
      } catch (error) {
        exitWithError(error, opts.json)
      }
    })
}
