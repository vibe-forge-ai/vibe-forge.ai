const { resolve } = require('node:path')
const process = require('node:process')

const {
  resolveProjectAiBaseDir,
  resolveProjectWorkspaceFolder
} = require('@vibe-forge/register/dotenv')

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = resolveProjectWorkspaceFolder(process.cwd(), process.env)
process.env.__VF_PROJECT_PACKAGE_DIR__ = __dirname
process.env.__VF_PROJECT_REAL_HOME__ = process.env.__VF_PROJECT_REAL_HOME__ ?? process.env.HOME ?? ''
process.env.HOME = resolve(resolveProjectAiBaseDir(process.cwd(), process.env), '.mock')

require('node:child_process').spawnSync(
  'node',
  [
    '--watch',
    '--watch-path',
    resolve(__dirname, './src'),
    '-C',
    '__vibe-forge__',
    '-r',
    require.resolve('@vibe-forge/register/esbuild'),
    resolve(__dirname, './src/index.ts')
  ],
  {
    stdio: 'inherit'
  }
)
