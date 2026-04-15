import process from 'node:process'

import {
  getConfigSectionValueAtPath,
  hasConfigSectionValue,
  parseConfigSectionPath,
  resolveConfigSectionPath
} from '@vibe-forge/config'

import { loadCommandState, resolveSourceConfig, resolveSourceSections } from './shared'
import type { ConfigReadSource, LoadedConfigCommandState } from './shared'

export interface ResolvedReadState {
  cwd: string
  source: ConfigReadSource
  state: LoadedConfigCommandState
  resolvedPath?: ReturnType<typeof resolveConfigSectionPath>
  value: unknown
}

export const resolveReadState = async (
  pathInput: string | undefined,
  sourceInput: ConfigReadSource | undefined
): Promise<ResolvedReadState> => {
  const cwd = process.cwd()
  const source = sourceInput ?? 'merged'
  const state = await loadCommandState(cwd)
  const sourceConfig = resolveSourceConfig(state, source)

  if (source !== 'merged' && sourceConfig == null) {
    throw new Error(`No ${source} config found for workspace "${cwd}".`)
  }

  if (pathInput == null || pathInput.trim() === '') {
    return {
      cwd,
      source,
      state,
      value: resolveSourceSections(state, source)
    }
  }

  const resolvedPath = resolveConfigSectionPath(parseConfigSectionPath(pathInput))
  const result = getConfigSectionValueAtPath(resolveSourceSections(state, source), resolvedPath)
  if (!result.exists || (resolvedPath.sectionPath.length === 0 && !hasConfigSectionValue(result.value))) {
    throw new Error(`Config path "${resolvedPath.normalizedPath}" was not found in ${source} config.`)
  }

  return {
    cwd,
    source,
    state,
    resolvedPath,
    value: result.value
  }
}
