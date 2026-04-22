import { Option } from 'commander'
import type { Command } from 'commander'

import { updateConfigFile } from '@vibe-forge/config'
import { normalizeProjectSkillInstall, resolveConfiguredSkillInstalls } from '@vibe-forge/utils'

import { resolveCliWorkspaceCwd } from '#~/workspace.js'

import { buildDeclaredSkillEntry, installDeclaredSkill } from './install'
import {
  buildGeneralSkillsUpdateValue,
  exitWithError,
  getSourceConfig,
  isSameDeclaredSkill,
  loadSkillsConfigState,
  matchesSkillSelector,
  printResult
} from './shared'
import { CONFIG_WRITE_SOURCES } from './types'
import type { SkillsAddOptions } from './types'

export const registerAddSkillSubcommand = (skillsCommand: Command) => {
  skillsCommand
    .command('add <skill>')
    .description('Declare a project skill in config and ensure it is installed locally')
    .addOption(
      new Option('--config-source <source>', 'Config source to update').choices([...CONFIG_WRITE_SOURCES]).default(
        'project'
      )
    )
    .option('--source <source>', 'Remote skills CLI source path')
    .option('--version <version>', 'Remote skill version passed to the skills CLI')
    .option('--rename <name>', 'Local skill name after install')
    .option('--registry <registry>', 'Package registry used to install the managed skills CLI')
    .option('--force', 'Replace the existing installed skill if it already exists', false)
    .option('--json', 'Print JSON output', false)
    .action(async (skill: string, opts: SkillsAddOptions) => {
      try {
        const workspaceFolder = resolveCliWorkspaceCwd()
        const declared = buildDeclaredSkillEntry(skill, opts)
        const normalized = normalizeProjectSkillInstall(declared)
        if (normalized == null) {
          throw new Error('Skill reference is required.')
        }

        const state = await loadSkillsConfigState(workspaceFolder)
        const source = opts.configSource ?? 'project'
        const sourceConfig = getSourceConfig(state, source)
        const configured = resolveConfiguredSkillInstalls(sourceConfig?.skills)

        const duplicate = configured.find(item => matchesSkillSelector(normalized.targetName, item))
        if (duplicate != null && !isSameDeclaredSkill(duplicate, declared)) {
          throw new Error(`Configured skill target "${normalized.targetName}" already exists in ${source} config.`)
        }

        const installResult = await installDeclaredSkill({
          force: opts.force,
          registry: opts.registry,
          skill: declared,
          workspaceFolder
        })

        const nextSkills = duplicate == null ? [...configured, declared] : configured
        const updated = await updateConfigFile({
          workspaceFolder,
          source,
          section: 'general',
          value: buildGeneralSkillsUpdateValue(sourceConfig, nextSkills)
        })

        printResult({
          action: 'add',
          configPath: updated.configPath,
          declared,
          installDir: installResult.installDir,
          name: installResult.name,
          workspaceFolder
        }, opts.json)
      } catch (error) {
        exitWithError(error, opts.json)
      }
    })
}
