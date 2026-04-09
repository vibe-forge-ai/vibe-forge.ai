import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

import type { ManagedPluginInstallConfig } from '@vibe-forge/types'
import { getManagedPluginConfigPath, getManagedPluginsRoot } from '@vibe-forge/utils/managed-plugin'

import { convertClaudePluginToVibeForge, toPluginSlug } from './plugin-convert'
import {
  detectClaudePluginRoot,
  installClaudePluginSource,
  parseClaudePluginManifest,
  pathExists,
  resolveClaudeSource
} from './plugin-source'

export interface InstallClaudePluginOptions {
  cwd?: string
  source: string
  force?: boolean
  scope?: string
}

export const installClaudePlugin = async (options: InstallClaudePluginOptions) => {
  const cwd = options.cwd ?? process.cwd()
  const source = await resolveClaudeSource(cwd, options.source)
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'vf-plugin-'))

  try {
    const downloadedRoot = await installClaudePluginSource(tempDir, cwd, source)
    const pluginRoot = await detectClaudePluginRoot(downloadedRoot)
    const manifest = await parseClaudePluginManifest(pluginRoot)
    if (manifest?.userConfig != null) {
      throw new Error(
        'Claude plugins that declare userConfig are not supported yet. Install requires marketplace-style plugin options, which Vibe Forge does not map yet.'
      )
    }
    const pluginName = manifest?.name?.trim() || path.basename(pluginRoot)
    const installSlug = toPluginSlug(pluginName)
    const pluginsRoot = getManagedPluginsRoot(cwd)
    const installDir = path.join(pluginsRoot, installSlug)
    const nativePluginDir = path.join(installDir, 'native')
    const vibeForgePluginDir = path.join(installDir, 'vibe-forge')
    const pluginDataDir = path.join(installDir, 'data')
    const managedConfigPath = getManagedPluginConfigPath(installDir)
    const installConfigExists = await pathExists(managedConfigPath)
    const installDirExists = await pathExists(installDir)

    if (installConfigExists && !options.force) {
      throw new Error(`Plugin ${pluginName} is already installed at ${installDir}. Use --force to replace it.`)
    }

    if (installDirExists) {
      await Promise.all([
        fs.rm(nativePluginDir, { recursive: true, force: true }),
        fs.rm(vibeForgePluginDir, { recursive: true, force: true }),
        fs.rm(managedConfigPath, { force: true })
      ])
    }

    await fs.mkdir(pluginsRoot, { recursive: true })
    await fs.mkdir(installDir, { recursive: true })
    const shouldRemoveInstallDirOnFailure = !installDirExists

    try {
      await fs.mkdir(pluginDataDir, { recursive: true })
      await fs.cp(pluginRoot, nativePluginDir, { recursive: true })
      await fs.mkdir(vibeForgePluginDir, { recursive: true })
      await convertClaudePluginToVibeForge({
        nativePluginRoot: nativePluginDir,
        vibeForgeRoot: vibeForgePluginDir,
        pluginName,
        pluginDataDir
      })
    } catch (error) {
      await Promise.all([
        fs.rm(nativePluginDir, { recursive: true, force: true }),
        fs.rm(vibeForgePluginDir, { recursive: true, force: true }),
        fs.rm(managedConfigPath, { force: true })
      ])
      if (shouldRemoveInstallDirOnFailure) {
        await fs.rm(installDir, { recursive: true, force: true })
      }
      throw error
    }

    const config: ManagedPluginInstallConfig = {
      version: 1,
      adapter: 'claude',
      name: pluginName,
      scope: options.scope?.trim() !== '' ? options.scope?.trim() : pluginName,
      installedAt: new Date().toISOString(),
      source,
      nativePluginPath: 'native',
      vibeForgePluginPath: 'vibe-forge'
    }
    await fs.writeFile(managedConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

    console.log(`Installed Claude plugin: ${pluginName}`)
    console.log(`  Native: ${nativePluginDir}`)
    console.log(`  Vibe Forge: ${vibeForgePluginDir}`)

    return {
      config,
      installDir,
      nativePluginDir,
      vibeForgePluginDir
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

export const normalizePluginAdapter = (value: string | undefined) => {
  if (value == null || value === 'claude' || value === 'claude-code') return 'claude'
  throw new Error(`Unsupported plugin adapter: ${value}`)
}
