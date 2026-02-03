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
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
  process.env.__VF_PROJECT_CLI_PACKAGE_DIR__ = __dirname
  require(process.env.__VF_PROJECT_CLI_BIN_SOURCE_ENTRY__)
}
