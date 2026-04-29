const { spawnSync } = require('node:child_process')
const { dirname, isAbsolute, resolve } = require('node:path')
const process = require('node:process')

const dotenv = require('dotenv')
const { findWorkspaceRoot } = require('./workspace')

const PRIMARY_WORKSPACE_ENV = '__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__'
const PROJECT_LAUNCH_CWD_ENV = '__VF_PROJECT_LAUNCH_CWD__'
const PROJECT_WORKSPACE_FOLDER_ENV = '__VF_PROJECT_WORKSPACE_FOLDER__'
const PROJECT_CONFIG_DIR_ENV = '__VF_PROJECT_CONFIG_DIR__'
const PROJECT_AI_BASE_DIR_ENV = '__VF_PROJECT_AI_BASE_DIR__'
const PROJECT_WORKSPACE_FOLDER_RESOLVE_CWD_ENV = '__VF_PROJECT_WORKSPACE_FOLDER_RESOLVE_CWD__'
const PROJECT_CONFIG_DIR_RESOLVE_CWD_ENV = '__VF_PROJECT_CONFIG_DIR_RESOLVE_CWD__'
const PROJECT_AI_BASE_DIR_RESOLVE_CWD_ENV = '__VF_PROJECT_AI_BASE_DIR_RESOLVE_CWD__'
const DEFAULT_PROJECT_AI_BASE_DIR = '.ai'

const normalizeDirPath = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : undefined
  if (!trimmed) {
    return undefined
  }

  return trimmed.replace(/[\\/]+$/, '')
}

const resolvePathFromBase = (baseDir, value) => {
  const normalizedValue = normalizeDirPath(value)
  if (normalizedValue == null) {
    return undefined
  }

  return isAbsolute(normalizedValue)
    ? resolve(normalizedValue)
    : resolve(baseDir, normalizedValue)
}

const resolveProjectLaunchCwd = (cwd = process.cwd(), env = process.env) => (
  resolvePathFromBase(resolve(cwd), env[PROJECT_LAUNCH_CWD_ENV]) ?? resolve(cwd)
)

const resolvePathSourceCwd = (cwd, env, sourceEnvName) => (
  resolvePathFromBase(resolve(cwd), env[sourceEnvName])
)

const resolvePathFromLaunchCwd = (cwd, value, env = process.env, sourceEnvName) => (
  resolvePathFromBase(
    resolvePathSourceCwd(cwd, env, sourceEnvName) ?? resolveProjectLaunchCwd(cwd, env),
    value
  )
)

const resolveProjectWorkspaceFolder = (cwd = process.cwd(), env = process.env) => (
  resolvePathFromLaunchCwd(cwd, env[PROJECT_WORKSPACE_FOLDER_ENV], env, PROJECT_WORKSPACE_FOLDER_RESOLVE_CWD_ENV) ??
    findWorkspaceRoot(resolveProjectLaunchCwd(cwd, env))
)

const resolveProjectConfigDir = (cwd = process.cwd(), env = process.env) => (
  resolvePathFromLaunchCwd(cwd, env[PROJECT_CONFIG_DIR_ENV], env, PROJECT_CONFIG_DIR_RESOLVE_CWD_ENV)
)

const resolveProjectAiBaseDir = (cwd = process.cwd(), env = process.env) => {
  const configuredBaseDir = normalizeDirPath(env[PROJECT_AI_BASE_DIR_ENV])
  if (configuredBaseDir == null) {
    return resolve(resolveProjectWorkspaceFolder(cwd, env), DEFAULT_PROJECT_AI_BASE_DIR)
  }

  const sourceCwd = resolvePathSourceCwd(cwd, env, PROJECT_AI_BASE_DIR_RESOLVE_CWD_ENV)
  return resolvePathFromBase(sourceCwd ?? resolveProjectLaunchCwd(cwd, env), configuredBaseDir)
}

const PROJECT_PATH_SOURCE_CWD_ENV_BY_KEY = {
  [PROJECT_WORKSPACE_FOLDER_ENV]: PROJECT_WORKSPACE_FOLDER_RESOLVE_CWD_ENV,
  [PROJECT_CONFIG_DIR_ENV]: PROJECT_CONFIG_DIR_RESOLVE_CWD_ENV,
  [PROJECT_AI_BASE_DIR_ENV]: PROJECT_AI_BASE_DIR_RESOLVE_CWD_ENV
}

const rememberProjectPathSources = (filePath, parsed) => {
  if (parsed == null) {
    return
  }

  for (const [key, sourceEnvName] of Object.entries(PROJECT_PATH_SOURCE_CWD_ENV_BY_KEY)) {
    const configuredValue = parsed[key]
    if (configuredValue == null || process.env[key] !== configuredValue) {
      continue
    }

    process.env[sourceEnvName] = dirname(filePath)
  }
}

const resolvePrimaryWorkspaceFolder = (workspaceFolder) => {
  const normalizedWorkspaceFolder = resolve(workspaceFolder)
  const explicitPrimaryWorkspaceFolder = process.env[PRIMARY_WORKSPACE_ENV]?.trim()
  if (explicitPrimaryWorkspaceFolder) {
    const resolvedPrimaryWorkspaceFolder = resolve(explicitPrimaryWorkspaceFolder)
    return resolvedPrimaryWorkspaceFolder === normalizedWorkspaceFolder
      ? undefined
      : resolvedPrimaryWorkspaceFolder
  }

  try {
    const result = spawnSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: workspaceFolder,
      encoding: 'utf8'
    })
    if (result.status !== 0) {
      return undefined
    }

    const gitCommonDir = result.stdout?.trim()
    if (!gitCommonDir) {
      return undefined
    }

    const primaryWorkspaceFolder = dirname(resolve(workspaceFolder, gitCommonDir))
    return primaryWorkspaceFolder === normalizedWorkspaceFolder
      ? undefined
      : primaryWorkspaceFolder
  } catch {
    return undefined
  }
}

const loadDotenv = (options = {}) => {
  if (options.workspaceFolder != null) {
    delete process.env[PROJECT_LAUNCH_CWD_ENV]
    delete process.env[PROJECT_WORKSPACE_FOLDER_ENV]
    delete process.env[PROJECT_CONFIG_DIR_ENV]
  }

  const launchCwd = resolveProjectLaunchCwd(
    options.workspaceFolder ?? process.cwd(),
    process.env
  )
  process.env[PROJECT_LAUNCH_CWD_ENV] = launchCwd
  const envFiles = process.env.__VF_PROJECT_DOTENV_FILES__
    ? process.env.__VF_PROJECT_DOTENV_FILES__
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    : undefined
  const files = options.files ?? envFiles ?? ['.env', '.env.dev']
  const packageDir = process.env.__VF_PROJECT_PACKAGE_DIR__
  const seenFiles = new Set()

  while (true) {
    const workspaceFolder = resolveProjectWorkspaceFolder(launchCwd, process.env)
    const configDir = resolveProjectConfigDir(launchCwd, process.env)
    const primaryWorkspaceFolder = resolvePrimaryWorkspaceFolder(workspaceFolder)
    const roots = [
      launchCwd,
      workspaceFolder,
      ...(configDir != null ? [configDir] : []),
      ...(packageDir && packageDir !== workspaceFolder ? [packageDir] : []),
      ...(primaryWorkspaceFolder &&
          primaryWorkspaceFolder !== launchCwd &&
          primaryWorkspaceFolder !== workspaceFolder &&
          primaryWorkspaceFolder !== configDir &&
          primaryWorkspaceFolder !== packageDir
        ? [primaryWorkspaceFolder]
        : [])
    ]
    const pendingFiles = []

    for (const root of roots) {
      for (const file of files) {
        const filePath = resolve(root, file)
        if (seenFiles.has(filePath)) {
          continue
        }

        pendingFiles.push(filePath)
      }
    }

    if (pendingFiles.length === 0) {
      break
    }

    for (const filePath of pendingFiles) {
      seenFiles.add(filePath)
      const result = dotenv.config({
        quiet: true,
        path: filePath
      })
      rememberProjectPathSources(filePath, result.parsed)
    }

    const resolvedWorkspaceFolder = resolveProjectWorkspaceFolder(launchCwd, process.env)
    const resolvedConfigDir = resolveProjectConfigDir(launchCwd, process.env)

    process.env[PROJECT_WORKSPACE_FOLDER_ENV] = resolvedWorkspaceFolder
    if (resolvedConfigDir != null) {
      process.env[PROJECT_CONFIG_DIR_ENV] = resolvedConfigDir
    }
  }
}

loadDotenv()

module.exports = {
  loadDotenv,
  resolvePrimaryWorkspaceFolder,
  resolveProjectAiBaseDir,
  resolveProjectMockHome: (cwd = process.cwd(), env = process.env) => (
    resolve(resolveProjectAiBaseDir(cwd, env), '.mock')
  ),
  resolveProjectConfigDir,
  resolveProjectLaunchCwd,
  resolveProjectWorkspaceFolder
}
