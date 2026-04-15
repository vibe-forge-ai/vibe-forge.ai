const path = require('node:path')
const process = require('node:process')

const resolveAiBaseDir = () => (
  process.env.__VF_PROJECT_AI_BASE_DIR__?.trim()?.replace(/[\\/]+$/, '') || '.ai'
)

const runCliPackageEntrypoint = (options) => {
  const {
    packageDir,
    sourceEntry = './src/cli',
    distEntry = './dist/cli.js'
  } = options ?? {}

  if (!packageDir || typeof packageDir !== 'string') {
    throw new Error('packageDir is required')
  }

  require('@vibe-forge/register/dotenv')

  process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
  process.env.__VF_PROJECT_PACKAGE_DIR__ = packageDir
  process.env.__VF_PROJECT_REAL_HOME__ = process.env.__VF_PROJECT_REAL_HOME__ ?? process.env.HOME ?? ''
  process.env.HOME = path.resolve(
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
    resolveAiBaseDir(),
    '.mock'
  )
  process.env.__VF_PROJECT_CLI_BIN_SOURCE_ENTRY__ = sourceEntry
  process.env.__VF_PROJECT_CLI_BIN_DIST_ENTRY__ = distEntry

  require('./loader')
}

module.exports = {
  runCliPackageEntrypoint
}
