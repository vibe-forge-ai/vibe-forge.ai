#!/usr/bin/env node

const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const process = require('node:process')

const splitNodePath = (value) => (
  typeof value === 'string'
    ? value
      .split(path.delimiter)
      .map(item => item.trim())
      .filter(Boolean)
    : []
)

const resolvePackageNodePaths = (packageDir) => {
  if (!packageDir || typeof packageDir !== 'string') return []

  try {
    const packageRequire = Module.createRequire(path.resolve(packageDir, 'package.json'))
    // Probe package resolution with a synthetic name so Node returns the
    // lookup paths for dependencies installed around the project package.
    return packageRequire.resolve.paths('@vibe-forge/hooks-node-path-probe') ?? []
  } catch {
    return []
  }
}

const bootstrapNodePath = () => {
  const packageDir = process.env.__VF_PROJECT_PACKAGE_DIR__ ?? __dirname
  const nextNodePaths = [
    ...new Set([
      ...splitNodePath(process.env.NODE_PATH),
      ...resolvePackageNodePaths(packageDir)
    ])
  ]

  if (nextNodePaths.length === 0) return

  process.env.NODE_PATH = nextNodePaths.join(path.delimiter)
  Module._initPaths()
}

bootstrapNodePath()

const {
  resolveProjectMockHome,
  resolveProjectWorkspaceFolder
} = require('@vibe-forge/register/dotenv')
const { linkRealHomeGitConfig } = require('@vibe-forge/register/mock-home-git')

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = resolveProjectWorkspaceFolder(process.cwd(), process.env)
process.env.__VF_PROJECT_PACKAGE_DIR__ = process.env.__VF_PROJECT_PACKAGE_DIR__ ?? __dirname
process.env.__VF_PROJECT_REAL_HOME__ = process.env.__VF_PROJECT_REAL_HOME__ ?? process.env.HOME ?? ''
process.env.HOME = resolveProjectMockHome(process.cwd(), process.env)
linkRealHomeGitConfig()

const sourceEntrypoint = path.resolve(__dirname, './src/entry.ts')
const distEntrypoint = path.resolve(__dirname, './dist/entry.js')
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
