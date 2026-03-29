const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const ENTRY_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']

const resolveEntryPath = (value) => {
  if (!value || typeof value !== 'string') return undefined
  if (path.isAbsolute(value)) return value

  const packageDir = process.env.__VF_PROJECT_PACKAGE_DIR__ ?? process.cwd()
  return path.resolve(packageDir, value)
}

const resolveExistingEntrypoint = (value) => {
  const resolvedPath = resolveEntryPath(value)
  if (resolvedPath == null) return undefined
  if (existsSync(resolvedPath)) return resolvedPath

  if (path.extname(resolvedPath) !== '') {
    return undefined
  }

  for (const extension of ENTRY_EXTENSIONS) {
    const candidatePath = `${resolvedPath}${extension}`
    if (existsSync(candidatePath)) {
      return candidatePath
    }
  }

  return undefined
}

const resolveCliEntrypoint = () => {
  const sourceEntrypoint = resolveExistingEntrypoint(process.env.__VF_PROJECT_CLI_BIN_SOURCE_ENTRY__)
  if (sourceEntrypoint != null) {
    return sourceEntrypoint
  }

  const distEntrypoint = resolveExistingEntrypoint(process.env.__VF_PROJECT_CLI_BIN_DIST_ENTRY__)
  if (distEntrypoint != null) {
    return distEntrypoint
  }

  throw new Error('CLI entrypoint not found. Set __VF_PROJECT_CLI_BIN_SOURCE_ENTRY__ or __VF_PROJECT_CLI_BIN_DIST_ENTRY__.')
}

if (!process.env.__IS_LOADER_CLI__) {
  const child = spawn(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: [
        '--conditions=__vibe-forge__',
        `--require=${require.resolve('@vibe-forge/register/preload')}`,
        process.env.NODE_OPTIONS ?? ''
      ].filter(Boolean).join(' ').trim(),
      __IS_LOADER_CLI__: 'true'
    }
  })

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
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
  process.env.__VF_PROJECT_PACKAGE_DIR__ = process.env.__VF_PROJECT_PACKAGE_DIR__ ?? process.cwd()
  process.env.__VF_PROJECT_CLI_PACKAGE_DIR__ = process.env.__VF_PROJECT_CLI_PACKAGE_DIR__ ?? process.env.__VF_PROJECT_PACKAGE_DIR__

  require(resolveCliEntrypoint())
}
