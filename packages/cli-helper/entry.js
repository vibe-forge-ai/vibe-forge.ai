const process = require('node:process')

const runCliPackageEntrypoint = (options) => {
  const {
    packageDir,
    sourceEntry = './src/cli',
    distEntry = './dist/cli.js'
  } = options ?? {}

  if (!packageDir || typeof packageDir !== 'string') {
    throw new Error('packageDir is required')
  }

  const {
    resolveProjectMockHome,
    resolveProjectWorkspaceFolder
  } = require('@vibe-forge/register/dotenv')
  const { linkRealHomeGitConfig } = require('@vibe-forge/register/mock-home-git')

  process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = resolveProjectWorkspaceFolder(process.cwd(), process.env)
  process.env.__VF_PROJECT_PACKAGE_DIR__ = packageDir
  process.env.__VF_PROJECT_REAL_HOME__ = process.env.__VF_PROJECT_REAL_HOME__ ?? process.env.HOME ?? ''
  process.env.HOME = resolveProjectMockHome(process.cwd(), process.env)
  linkRealHomeGitConfig()
  process.env.__VF_PROJECT_CLI_BIN_SOURCE_ENTRY__ = sourceEntry
  process.env.__VF_PROJECT_CLI_BIN_DIST_ENTRY__ = distEntry

  require('./loader')
}

module.exports = {
  runCliPackageEntrypoint
}
