const process = require('node:process')

if (!process.env.__IS_LOADER_CLI__) {
  const { execPath } = process

  const args = process.argv.slice(1)

  const nodeOptions = [`--require=${require.resolve('./register.js')}`].join(
    ' '
  )

  require('node:child_process').spawn(execPath, args, {
    stdio: 'inherit',
    env: {
      ...process.env,

      NODE_OPTIONS: `--conditions=__vibe-forge__ ${nodeOptions} ${process.env.NODE_OPTIONS ?? ''}`,

      __IS_LOADER_CLI__: 'true'
    }
  })
} else {
  process.env.WORKSPACE_FOLDER = process.env.WORKSPACE_FOLDER ?? process.cwd()
  process.env.CLI_PACKAGE_DIR = __dirname
  require(process.env.CLI_BIN_SOURCE_ENTRY)
}
