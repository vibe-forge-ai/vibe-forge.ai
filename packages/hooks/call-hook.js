const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const { resolve } = require('node:path')
const process = require('node:process')

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
process.env.__VF_PROJECT_PACKAGE_DIR__ = process.env.__VF_PROJECT_PACKAGE_DIR__ ?? __dirname
process.env.HOME = resolve(
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
  './.ai/.mock'
)

require('@vibe-forge/register/dotenv')

const sourceEntrypoint = resolve(__dirname, './src/entry.ts')
const distEntrypoint = resolve(__dirname, './dist/entry.js')
const shouldLoadSourceEntrypoint = existsSync(sourceEntrypoint)

if (shouldLoadSourceEntrypoint && !process.env.__IS_VF_HOOK_LOADER__) {
  const child = spawn(
    process.execPath,
    [
      '--conditions=__vibe-forge__',
      '--require',
      require.resolve('@vibe-forge/register/preload'),
      ...process.argv.slice(1)
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        __IS_VF_HOOK_LOADER__: 'true'
      }
    }
  )

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  function handleSigint() {
    forwardSignal('SIGINT')
  }

  function handleSigterm() {
    forwardSignal('SIGTERM')
  }

  const cleanup = () => {
    process.off('SIGINT', handleSigint)
    process.off('SIGTERM', handleSigterm)
  }

  process.on('SIGINT', handleSigint)
  process.on('SIGTERM', handleSigterm)

  child.on('error', (error) => {
    cleanup()
    console.error(error.message)
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    cleanup()
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
} else {
  const entrypoint = shouldLoadSourceEntrypoint ? sourceEntrypoint : distEntrypoint
  const { runManagedHookEntrypoint } = require(entrypoint)
  void runManagedHookEntrypoint()
}
