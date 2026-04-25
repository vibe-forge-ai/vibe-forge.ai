#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const { existsSync, realpathSync } = require('node:fs')
const { resolve } = require('node:path')
const process = require('node:process')

const {
  resolveProjectAiBaseDir,
  resolveProjectWorkspaceFolder
} = require('@vibe-forge/register/dotenv')
const { linkRealHomeGitConfig } = require('@vibe-forge/register/mock-home-git')
const { startPreviewServer } = require('./preview-server.cjs')

process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = resolveProjectWorkspaceFolder(process.cwd(), process.env)
process.env.__VF_PROJECT_PACKAGE_DIR__ = __dirname
process.env.__VF_PROJECT_REAL_HOME__ = process.env.__VF_PROJECT_REAL_HOME__ ?? process.env.HOME ?? ''
process.env.HOME = resolve(resolveProjectAiBaseDir(process.cwd(), process.env), '.mock')
linkRealHomeGitConfig()

const cwd = realpathSync(resolve(__dirname, './'))
const clientMode = (process.env.__VF_PROJECT_AI_CLIENT_MODE__ ?? '').trim().toLowerCase()

const resolveViteBin = () => {
  try {
    return require.resolve('vite/bin/vite.js', {
      paths: [cwd, process.cwd(), __dirname]
    })
  } catch {
    return null
  }
}

const runDevServer = () => {
  const viteBin = resolveViteBin()
  const hasDevSource = existsSync(resolve(cwd, './vite.config.ts'))

  if (viteBin == null || !hasDevSource) {
    console.error(
      '[client] dev mode requires a local Vibe Forge source checkout with workspace dependencies installed.'
    )
    process.exit(1)
  }

  const result = spawnSync(process.execPath, [viteBin], {
    cwd,
    env: process.env,
    stdio: 'inherit'
  })
  process.exit(result.status ?? 1)
}

const runPreviewServer = async () => {
  const preview = await startPreviewServer({
    base: process.env.__VF_PROJECT_AI_CLIENT_BASE__,
    distPath: resolve(cwd, './dist'),
    host: process.env.__VF_PROJECT_AI_CLIENT_HOST__ || '127.0.0.1',
    port: Number(process.env.__VF_PROJECT_AI_CLIENT_PORT__ ?? 4173),
    runtimeEnv: process.env
  })
  console.log(`[client]             ${preview.url}`)
}

if (clientMode === 'dev') {
  runDevServer()
} else {
  runPreviewServer().catch((error) => {
    console.error('[client] failed to start preview server:', error)
    process.exit(1)
  })
}
