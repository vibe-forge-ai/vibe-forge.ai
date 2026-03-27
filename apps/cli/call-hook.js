const process = require('node:process')

require('@vibe-forge/register/dotenv')

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
process.env.__VF_PROJECT_PACKAGE_DIR__ = __dirname
require(require.resolve('@vibe-forge/core/call-hook.js'))
