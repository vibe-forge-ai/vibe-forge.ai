import process from 'node:process'

import type { Config } from '@vibe-forge/types'

import { buildConfigJsonVariables, loadConfig } from './load'

export const resolveInjectDefaultSystemPromptValue = (options: {
  cliValue?: boolean
  projectConfig?: Config
  userConfig?: Config
}) => (
  options.cliValue ??
    options.userConfig?.conversation?.injectDefaultSystemPrompt ??
    options.projectConfig?.conversation?.injectDefaultSystemPrompt ??
    true
)

export async function loadInjectDefaultSystemPromptValue(
  cwd: string,
  cliValue?: boolean
) {
  if (cliValue != null) return cliValue

  const [projectConfig, userConfig] = await loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })

  return resolveInjectDefaultSystemPromptValue({
    projectConfig,
    userConfig
  })
}

export const mergeSystemPrompts = (options: {
  generatedSystemPrompt?: string
  userSystemPrompt?: string
  injectDefaultSystemPrompt?: boolean
}) => {
  const value = [
    options.injectDefaultSystemPrompt === false ? undefined : options.generatedSystemPrompt,
    options.userSystemPrompt
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join('\n\n')

  return value === '' ? undefined : value
}
