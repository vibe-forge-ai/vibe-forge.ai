import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import type { AdapterCtx, AdapterInitOptions } from '@vibe-forge/core'

import { generateDefaultCCRConfigJSON } from '../ccr/default-config'
import { resolveAdapterCliPath } from '../ccr/paths'

export const initClaudeCodeAdapter = async (ctx: AdapterCtx, options: AdapterInitOptions) => {
  const { cwd, env, configs: [config, userConfig], logger } = ctx
  const adapterOptions = {
    ...(config?.adapters?.['claude-code'] ?? {}),
    ...(userConfig?.adapters?.['claude-code'] ?? {})
  }
  const configPath = resolve(cwd, '.ai/.mock/.claude-code-router/config.json')
  if (!options.force) {
    try {
      await access(configPath)
      console.warn(`${configPath} already exists, use --force to override`)
      return
    } catch {
    }
  }
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(
    configPath,
    generateDefaultCCRConfigJSON({
      cwd,
      config,
      userConfig,
      adapterOptions
    })
  )
  const homePath = resolve(cwd, '.ai/.mock')
  const cliPath = resolveAdapterCliPath()
  if (!existsSync(cliPath)) {
    console.warn(`ccr binary not found at ${cliPath}, skip restart`)
    return
  }
  logger.info('Claude Code init: restart router', { cliPath, homePath })
  await new Promise((resolvePromise, reject) => {
    const proc = spawn(cliPath, ['restart'], {
      env: {
        ...process.env,
        ...env,
        HOME: homePath
      },
      cwd
    })
    proc.on('exit', (code) => {
      if (code === 0) {
        resolvePromise(null)
      } else {
        reject(new Error(`ccr restart failed with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
}
