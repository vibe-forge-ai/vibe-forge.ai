import { access } from 'node:fs/promises'
import process from 'node:process'

import { Option } from 'commander'
import type { Command } from 'commander'

import { buildConfigJsonVariables, loadConfigState, updateConfigFile } from '@vibe-forge/config'
import type { ConfigSource } from '@vibe-forge/config'
import type { Config, ConfiguredSkillInstallConfig } from '@vibe-forge/types'
import {
  installProjectSkill,
  normalizeProjectSkillInstall,
  publishSkillsCli,
  readProjectSkills,
  removeProjectSkill,
  resolveConfiguredSkillInstalls,
  resolveProjectAiPath,
  resolveProjectSkillPublishSpec,
  resolveSkillsCliRuntimeConfig,
  toSkillSlug
} from '@vibe-forge/utils'

import { resolveCliWorkspaceCwd } from '#~/workspace.js'

const CONFIG_WRITE_SOURCES = ['project', 'user'] as const
const CONFIG_REMOVE_SOURCES = ['project', 'user', 'all'] as const

type ConfigWriteSource = typeof CONFIG_WRITE_SOURCES[number]
type ConfigRemoveSource = typeof CONFIG_REMOVE_SOURCES[number]

interface SkillsInstallOptions {
  force?: boolean
  json?: boolean
  registry?: string
  rename?: string
  source?: string
}

interface SkillsAddOptions extends SkillsInstallOptions {
  configSource?: ConfigWriteSource
}

interface SkillsRemoveOptions {
  configSource?: ConfigRemoveSource
  json?: boolean
  keepFiles?: boolean
}

interface SkillsPublishOptions {
  access?: string
  group?: boolean | string
  json?: boolean
  region?: string
  registry?: string
  yes?: boolean
}

const normalizeString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const printResult = (value: unknown, json = false) => {
  if (json) {
    console.log(JSON.stringify(
      value != null && typeof value === 'object' && !Array.isArray(value)
        ? { ok: true, ...(value as Record<string, unknown>) }
        : { ok: true, value },
      null,
      2
    ))
    return
  }

  if (typeof value === 'string') {
    console.log(value)
    return
  }

  console.log(JSON.stringify(value, null, 2))
}

const exitWithError = (error: unknown, json = false): never => {
  const message = error instanceof Error ? error.message : String(error)
  if (json) {
    console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  } else {
    console.error(message)
  }
  process.exit(1)
}

const buildDeclaredSkillEntry = (
  skillArg: string,
  options: Pick<SkillsInstallOptions, 'rename' | 'source'>
): string | ConfiguredSkillInstallConfig => {
  const skill = normalizeString(skillArg)
  if (skill == null) {
    throw new Error('Skill reference is required.')
  }

  const explicitSource = normalizeString(options.source)
  const rename = normalizeString(options.rename)
  const parsed = normalizeProjectSkillInstall(skill)
  if (parsed == null) {
    throw new Error(`Invalid skill reference "${skillArg}".`)
  }

  if (explicitSource != null && parsed.source != null) {
    throw new Error('--source cannot be used when the skill reference already includes a source.')
  }

  if (explicitSource == null && rename == null) {
    return skill
  }

  return {
    name: parsed.name,
    ...(explicitSource != null
      ? { source: explicitSource }
      : (parsed.source != null ? { source: parsed.source } : {})),
    ...(rename != null ? { rename } : {})
  }
}

const loadSkillsConfigState = async (cwd: string) => (
  await loadConfigState({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })
)

const getSourceConfig = (state: Awaited<ReturnType<typeof loadSkillsConfigState>>, source: ConfigSource) => (
  source === 'user' ? state.userConfig : state.projectConfig
)

const buildGeneralSkillsUpdateValue = (
  sourceConfig: Config | undefined,
  nextSkills: Array<string | ConfiguredSkillInstallConfig>
) => {
  const value: Record<string, unknown> = {
    skills: nextSkills.length === 0 ? undefined : nextSkills
  }
  const skillsCli = resolveSkillsCliRuntimeConfig(sourceConfig)
  if (skillsCli != null) {
    value.skillsCli = skillsCli
  }
  return value
}

const isSameDeclaredSkill = (
  left: string | ConfiguredSkillInstallConfig,
  right: string | ConfiguredSkillInstallConfig
) => {
  const normalizedLeft = normalizeProjectSkillInstall(left)
  const normalizedRight = normalizeProjectSkillInstall(right)

  if (normalizedLeft != null && normalizedRight != null) {
    return normalizedLeft.ref === normalizedRight.ref &&
      normalizedLeft.targetName === normalizedRight.targetName &&
      normalizedLeft.rename === normalizedRight.rename &&
      normalizedLeft.source === normalizedRight.source
  }

  return left === right
}

const matchesSkillSelector = (selector: string, value: string | ConfiguredSkillInstallConfig) => {
  const normalized = normalizeProjectSkillInstall(value)
  if (normalized == null) return false

  const trimmedSelector = selector.trim()
  const selectorSlug = toSkillSlug(trimmedSelector)
  return (
    trimmedSelector === normalized.ref ||
    trimmedSelector === normalized.name ||
    trimmedSelector === normalized.targetName ||
    trimmedSelector === normalized.targetDirName ||
    selectorSlug === normalized.targetDirName ||
    selectorSlug === toSkillSlug(normalized.name) ||
    selectorSlug === toSkillSlug(normalized.targetName)
  )
}

const resolveInstalledSkillDirNames = async (workspaceFolder: string, selector: string) => {
  const trimmedSelector = selector.trim()
  const selectorSlug = toSkillSlug(trimmedSelector)
  const skills = await readProjectSkills(workspaceFolder)
  return skills
    .filter(skill => (
      skill.dirName === trimmedSelector ||
      skill.name === trimmedSelector ||
      skill.dirName === selectorSlug ||
      toSkillSlug(skill.name) === selectorSlug
    ))
    .map(skill => skill.dirName)
}

const installDeclaredSkill = async (params: {
  config?: Config['skillsCli']
  force?: boolean
  registry?: string
  skill: string | ConfiguredSkillInstallConfig
  workspaceFolder: string
}) => {
  const normalized = normalizeProjectSkillInstall(params.skill)
  if (normalized == null) {
    throw new Error('Skill reference is required.')
  }

  const existingSkillPath = resolveProjectAiPath(
    params.workspaceFolder,
    process.env,
    'skills',
    normalized.targetDirName,
    'SKILL.md'
  )
  const hadExisting = await pathExists(existingSkillPath)
  const installed = params.force === true || !hadExisting
    ? await installProjectSkill({
      config: params.config,
      force: params.force,
      registry: params.registry,
      skill: normalized,
      workspaceFolder: params.workspaceFolder
    })
    : {
      dirName: normalized.targetDirName,
      installDir: resolveProjectAiPath(params.workspaceFolder, process.env, 'skills', normalized.targetDirName),
      name: normalized.targetName,
      ref: normalized.ref,
      skillPath: existingSkillPath
    }

  return {
    ...installed,
    skipped: params.force !== true && hadExisting
  }
}

const resolveInstallTargets = async (params: {
  args: string[]
  options: Pick<SkillsInstallOptions, 'rename' | 'source'>
  workspaceFolder: string
}) => {
  if (params.args.length > 0) {
    if (params.args.length > 1 && (params.options.rename != null || params.options.source != null)) {
      throw new Error('--source and --rename only support a single explicit skill argument.')
    }
    return params.args.map((arg) => buildDeclaredSkillEntry(arg, params.options))
  }

  const state = await loadSkillsConfigState(params.workspaceFolder)
  const configured = resolveConfiguredSkillInstalls(state.mergedConfig.skills)
  if (configured.length === 0) {
    throw new Error('No configured skills found. Add a skill first or pass an explicit skill reference.')
  }
  return configured
}

export function registerSkillsCommand(program: Command) {
  const skillsCommand = program
    .command('skills')
    .description('Install and manage project skills declared in workspace config')

  skillsCommand
    .command('add <skill>')
    .description('Declare a project skill in config and ensure it is installed locally')
    .addOption(
      new Option('--config-source <source>', 'Config source to update').choices([...CONFIG_WRITE_SOURCES]).default(
        'project'
      )
    )
    .option('--source <source>', 'Remote skills CLI source path')
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
          config: resolveSkillsCliRuntimeConfig(state.mergedConfig),
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
