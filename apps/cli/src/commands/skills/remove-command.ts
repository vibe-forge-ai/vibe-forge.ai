import { Option } from 'commander'
import type { Command } from 'commander'

import type { ConfigSource } from '@vibe-forge/config'
import { updateConfigFile } from '@vibe-forge/config'
import { normalizeProjectSkillInstall, removeProjectSkill, resolveConfiguredSkillInstalls } from '@vibe-forge/utils'

import { resolveCliWorkspaceCwd } from '#~/workspace.js'

import {
  buildGeneralSkillsUpdateValue,
  exitWithError,
  getSourceConfig,
  loadSkillsConfigState,
  matchesSkillSelector,
  normalizeString,
  printResult,
  resolveInstalledSkillDirNames
} from './shared'
import { CONFIG_REMOVE_SOURCES } from './types'
import type { SkillsRemoveOptions } from './types'

export const registerRemoveSkillSubcommand = (skillsCommand: Command) => {
  skillsCommand
    .command('remove <skill>')
    .description('Remove a configured project skill and delete the local installed directory')
    .addOption(
      new Option('--config-source <source>', 'Config source(s) to update').choices([...CONFIG_REMOVE_SOURCES]).default(
        'all'
      )
    )
    .option('--keep-files', 'Only update config and keep local installed files', false)
    .option('--json', 'Print JSON output', false)
    .action(async (skill: string, opts: SkillsRemoveOptions) => {
      try {
        const workspaceFolder = resolveCliWorkspaceCwd()
        const state = await loadSkillsConfigState(workspaceFolder)
        const selector = normalizeString(skill)
        if (selector == null) {
          throw new Error('Skill selector is required.')
        }

        const removedConfigSources: string[] = []
        const removedDirNames = new Set<string>()
        const sources: ConfigSource[] = opts.configSource === 'all'
          ? ['project', 'user']
          : [opts.configSource ?? 'project']

        for (const source of sources) {
          const sourceConfig = getSourceConfig(state, source)
          const configured = resolveConfiguredSkillInstalls(sourceConfig?.skills)
          const remaining = configured.filter(item => !matchesSkillSelector(selector, item))
          const matched = configured.filter(item => matchesSkillSelector(selector, item))
          if (matched.length === 0) continue

          for (const item of matched) {
            const normalized = normalizeProjectSkillInstall(item)
            if (normalized != null) {
              removedDirNames.add(normalized.targetDirName)
            }
          }

          await updateConfigFile({
            workspaceFolder,
            source,
            section: 'general',
            value: buildGeneralSkillsUpdateValue(sourceConfig, remaining)
          })
          removedConfigSources.push(source)
        }

        const installedDirNames = await resolveInstalledSkillDirNames(workspaceFolder, selector)
        for (const dirName of installedDirNames) {
          removedDirNames.add(dirName)
        }

        const removedDirs = opts.keepFiles === true
          ? []
          : await Promise.all(
            Array.from(removedDirNames).map(dirName =>
              removeProjectSkill({
                dirName,
                workspaceFolder
              })
            )
          )

        if (removedConfigSources.length === 0 && removedDirs.length === 0) {
          throw new Error(`No configured or installed skill matched "${selector}".`)
        }

        printResult({
          action: 'remove',
          removedConfigSources,
          removedDirs: removedDirs.map(item => item.installDir),
          workspaceFolder
        }, opts.json)
      } catch (error) {
        exitWithError(error, opts.json)
      }
    })
}
