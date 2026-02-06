const path = require('node:path')
const process = require('node:process')

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
process.env.HOME = path.resolve(
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
  './.ai/.mock'
)
process.env.__VF_PROJECT_CLI_BIN_SOURCE_ENTRY__ = './src/cli'

require('./cli-helper')
