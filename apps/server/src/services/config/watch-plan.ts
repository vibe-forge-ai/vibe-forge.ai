import { dirname, resolve } from 'node:path'
import process from 'node:process'

import {
  resolvePrimaryWorkspaceFolder,
  resolveProjectConfigDir,
  resolveProjectWorkspaceFolder
} from '@vibe-forge/utils'

const PROJECT_CONFIG_RELATIVE_PATHS = [
  '.ai.config.json',
  'infra/.ai.config.json',
  '.ai.config.yaml',
  'infra/.ai.config.yaml',
  '.ai.config.yml',
  'infra/.ai.config.yml'
] as const

const USER_CONFIG_RELATIVE_PATHS = [
  '.ai.dev.config.json',
  'infra/.ai.dev.config.json',
  '.ai.dev.config.yaml',
  'infra/.ai.dev.config.yaml',
  '.ai.dev.config.yml',
  'infra/.ai.dev.config.yml'
] as const

const CONFIG_INFRA_DIR = 'infra'

interface ConfigWatchSourceState {
  configPath?: string
  resolvedExtendPaths?: string[]
}

const addRelativeTargets = (
  targets: Set<string>,
  cwd: string,
  relativePaths: readonly string[]
) => {
  for (const relativePath of relativePaths) {
    targets.add(resolve(cwd, relativePath))
  }
}

const collectBaseConfigTargets = (workspaceFolder: string) => {
  const resolvedWorkspaceFolder = resolveProjectWorkspaceFolder(workspaceFolder, process.env)
  const configCwd = resolveProjectConfigDir(workspaceFolder, process.env) ?? resolvedWorkspaceFolder
  const primaryWorkspaceFolder = resolvePrimaryWorkspaceFolder(resolvedWorkspaceFolder, process.env)
  const targets = new Set<string>()

  addRelativeTargets(targets, configCwd, PROJECT_CONFIG_RELATIVE_PATHS)
  addRelativeTargets(targets, configCwd, USER_CONFIG_RELATIVE_PATHS)
  targets.add(resolve(configCwd, CONFIG_INFRA_DIR))

  if (primaryWorkspaceFolder != null && resolve(primaryWorkspaceFolder) !== resolve(configCwd)) {
    addRelativeTargets(targets, primaryWorkspaceFolder, USER_CONFIG_RELATIVE_PATHS)
    targets.add(resolve(primaryWorkspaceFolder, CONFIG_INFRA_DIR))
  }

  return targets
}

export const buildDirectoryTargetPlan = (targets: Iterable<string>) => {
  const plan = new Map<string, Set<string>>()

  for (const target of targets) {
    const targetPath = resolve(target)
    const dir = dirname(targetPath)
    const entry = plan.get(dir)
    if (entry == null) {
      plan.set(dir, new Set([targetPath]))
      continue
    }
    entry.add(targetPath)
  }

  return plan
}

export const buildBaseConfigWatchPlan = (workspaceFolder: string) => (
  buildDirectoryTargetPlan(collectBaseConfigTargets(workspaceFolder))
)

export const buildConfigWatchPlan = (
  workspaceFolder: string,
  sources: {
    projectSource?: ConfigWatchSourceState
    userSource?: ConfigWatchSourceState
  }
) => {
  const targets = collectBaseConfigTargets(workspaceFolder)

  for (
    const target of [
      sources.projectSource?.configPath,
      sources.userSource?.configPath,
      ...(sources.projectSource?.resolvedExtendPaths ?? []),
      ...(sources.userSource?.resolvedExtendPaths ?? [])
    ]
  ) {
    if (target != null && target !== '') {
      targets.add(resolve(target))
    }
  }

  return buildDirectoryTargetPlan(targets)
}
