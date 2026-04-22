import type { Command } from 'commander'

import { resolveSkillsCliRuntimeConfig } from '@vibe-forge/utils'

import { resolveCliWorkspaceCwd } from '#~/workspace.js'

import { installDeclaredSkill, resolveInstallTargets } from './install'
import { exitWithError, loadSkillsConfigState, printResult } from './shared'
import type { SkillsInstallOptions } from './types'

export const registerInstallSkillSubcommands = (skillsCommand: Command) => {
  skillsCommand
    .command('install [skills...]')
    .description('Install explicit project skills or all configured skills when no arguments are provided')
    .option('--source <source>', 'Remote skills CLI source path for a single explicit skill')
    .option('--rename <name>', 'Local skill name after install for a single explicit skill')
    .option('--registry <registry>', 'Package registry used to install the managed skills CLI')
    .option('--force', 'Replace existing installed skills', false)
    .option('--json', 'Print JSON output', false)
    .action(async (skills: string[], opts: SkillsInstallOptions) => {
      try {
        const workspaceFolder = resolveCliWorkspaceCwd()
        const state = await loadSkillsConfigState(workspaceFolder)
        const targets = await resolveInstallTargets({
          args: skills,
          options: opts,
          workspaceFolder
        })
        const installed = await Promise.all(
          targets.map(skill =>
            installDeclaredSkill({
              config: resolveSkillsCliRuntimeConfig(state.mergedConfig),
              force: opts.force,
              registry: opts.registry,
              skill,
              workspaceFolder
            })
          )
        )

        printResult({
          action: 'install',
          installed: installed.map(item => ({
            dirName: item.dirName,
            installDir: item.installDir,
            name: item.name,
            ref: item.ref,
            skipped: item.skipped
          })),
          workspaceFolder
        }, opts.json)
      } catch (error) {
        exitWithError(error, opts.json)
      }
    })

  skillsCommand
    .command('update [skills...]')
    .description('Force refresh explicit project skills or all configured skills when no arguments are provided')
    .option('--source <source>', 'Remote skills CLI source path for a single explicit skill')
    .option('--rename <name>', 'Local skill name after install for a single explicit skill')
    .option('--registry <registry>', 'Package registry used to install the managed skills CLI')
    .option('--json', 'Print JSON output', false)
    .action(async (skills: string[], opts: Omit<SkillsInstallOptions, 'force'>) => {
      try {
        const workspaceFolder = resolveCliWorkspaceCwd()
        const state = await loadSkillsConfigState(workspaceFolder)
        const targets = await resolveInstallTargets({
          args: skills,
          options: opts,
          workspaceFolder
        })
        const installed = await Promise.all(
          targets.map(skill =>
            installDeclaredSkill({
              config: resolveSkillsCliRuntimeConfig(state.mergedConfig),
              force: true,
              registry: opts.registry,
              skill,
              workspaceFolder
            })
          )
        )

        printResult({
          action: 'update',
          installed: installed.map(item => ({
            dirName: item.dirName,
            installDir: item.installDir,
            name: item.name,
            ref: item.ref
          })),
          workspaceFolder
        }, opts.json)
      } catch (error) {
        exitWithError(error, opts.json)
      }
    })
}
