import path from 'node:path'

import type { AdapterPluginInstaller } from '@vibe-forge/types'

import { convertClaudePluginToVibeForge } from './convert'
import { resolveClaudeMarketplaceInstallSource } from './marketplace'
import type { ClaudePluginManifest } from './source'
import { detectClaudePluginRoot, mergeClaudePluginManifest, parseClaudePluginManifest } from './source'

const formatClaudeInstallSummary = (params: {
  pluginName: string
  nativePluginDir: string
  vibeForgePluginDir: string
}) => [
  `Installed Claude plugin: ${params.pluginName}`,
  `  Native: ${params.nativePluginDir}`,
  `  Vibe Forge: ${params.vibeForgePluginDir}`
]

const validateClaudeManifest = (params: {
  manifest: ClaudePluginManifest | undefined
}) => {
  if (params.manifest?.userConfig != null) {
    throw new Error(
      'Claude plugins that declare userConfig are not supported yet. Install requires marketplace-style plugin options, which Vibe Forge does not map yet.'
    )
  }
}

export const claudeCodePluginInstaller: AdapterPluginInstaller<ClaudePluginManifest> = {
  adapter: 'claude',
  displayName: 'Claude',
  resolveSource: resolveClaudeMarketplaceInstallSource,
  detectPluginRoot: detectClaudePluginRoot,
  readManifest: parseClaudePluginManifest,
  mergeManifest: mergeClaudePluginManifest,
  validateManifest: validateClaudeManifest,
  getPluginName: ({ pluginRoot, manifest }) => manifest?.name?.trim() || path.basename(pluginRoot),
  convertToVibeForge: convertClaudePluginToVibeForge,
  formatInstallSummary: formatClaudeInstallSummary
}

export default claudeCodePluginInstaller
