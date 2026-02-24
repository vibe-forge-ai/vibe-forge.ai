const { resolve } = require('node:path')
const process = require('node:process')

require('@vibe-forge/register/dotenv')

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
process.env.__VF_PROJECT_PACKAGE_DIR__ = __dirname
process.env.HOME = resolve(
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
  './.ai/.mock'
)

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
