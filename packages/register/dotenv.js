const { spawnSync } = require('node:child_process')
const { dirname, resolve } = require('node:path')
const process = require('node:process')

const dotenv = require('dotenv')

const PRIMARY_WORKSPACE_ENV = '__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__'

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
  const workspaceFolder = options.workspaceFolder ??
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ??
    process.cwd()
  const primaryWorkspaceFolder = resolvePrimaryWorkspaceFolder(workspaceFolder)
  const envFiles = process.env.__VF_PROJECT_DOTENV_FILES__
    ? process.env.__VF_PROJECT_DOTENV_FILES__
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    : undefined
  const files = options.files ?? envFiles ?? ['.env', '.env.dev']
  const packageDir = process.env.__VF_PROJECT_PACKAGE_DIR__
  const roots = [
    workspaceFolder,
    ...(packageDir && packageDir !== workspaceFolder ? [packageDir] : []),
    ...(primaryWorkspaceFolder &&
        primaryWorkspaceFolder !== workspaceFolder &&
        primaryWorkspaceFolder !== packageDir
      ? [primaryWorkspaceFolder]
      : [])
  ]

  for (const root of roots) {
    for (const file of files) {
      dotenv.config({
        quiet: true,
        path: resolve(root, file)
      })
    }
  }
}

loadDotenv()

module.exports = {
  loadDotenv,
  resolvePrimaryWorkspaceFolder
}
