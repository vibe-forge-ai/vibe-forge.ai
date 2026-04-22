const { spawnSync } = require('node:child_process')
const { existsSync, realpathSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const process = require('node:process')

const WORKSPACE_CONFIG_MARKERS = [
  '.ai.config.json',
  '.ai.config.yaml',
  '.ai.config.yml',
  'infra/.ai.config.json',
  'infra/.ai.config.yaml',
  'infra/.ai.config.yml'
]

const WORKSPACE_ROOT_MARKERS = [
  'pnpm-workspace.yaml',
  '.git'
]

const resolveAiBaseDir = () => (
  process.env.__VF_PROJECT_AI_BASE_DIR__?.trim()?.replace(/[\\/]+$/, '') || '.ai'
)

const normalizePath = (value) => {
  const resolvedPath = resolve(value)

  try {
    return typeof realpathSync.native === 'function'
      ? realpathSync.native(resolvedPath)
      : realpathSync(resolvedPath)
  } catch {
    return resolvedPath
  }
}

const hasWorkspaceConfigMarker = (dir) => (
  WORKSPACE_CONFIG_MARKERS.some(marker => existsSync(resolve(dir, marker)))
)

const hasWorkspaceRootMarker = (dir) => (
  existsSync(resolve(dir, resolveAiBaseDir())) ||
  WORKSPACE_ROOT_MARKERS.some(marker => existsSync(resolve(dir, marker)))
)

const findGitRoot = (startDir) => {
  try {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startDir,
      encoding: 'utf8'
    })
    if (result.status !== 0) {
      return undefined
    }

    const gitRoot = result.stdout?.trim()
    return gitRoot ? normalizePath(gitRoot) : undefined
  } catch {
    return undefined
  }
}

const findWorkspaceRoot = (startDir = process.cwd()) => {
  const normalizedStartDir = normalizePath(startDir)
  const gitRoot = findGitRoot(normalizedStartDir)
  let packageJsonCandidate
  let currentDir = normalizedStartDir

  while (true) {
    if (hasWorkspaceConfigMarker(currentDir) || hasWorkspaceRootMarker(currentDir)) {
      return currentDir
    }

    if (packageJsonCandidate == null && existsSync(resolve(currentDir, 'package.json'))) {
      packageJsonCandidate = currentDir
    }

    if (gitRoot != null && currentDir === gitRoot) {
      break
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }
    currentDir = parentDir
  }

  return gitRoot ?? packageJsonCandidate ?? normalizedStartDir
}

const resolveWorkspaceFolder = (startDir = process.cwd()) => {
  const explicitWorkspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__?.trim()
  return explicitWorkspaceFolder ? normalizePath(explicitWorkspaceFolder) : findWorkspaceRoot(startDir)
}

module.exports = {
  findWorkspaceRoot,
  resolveWorkspaceFolder
}
