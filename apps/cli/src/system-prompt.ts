import process from 'node:process'

import type { Config } from '@vibe-forge/core'
import { loadConfig } from '@vibe-forge/core'

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
    jsonVariables: {
      ...process.env,
      WORKSPACE_FOLDER: cwd,
      __VF_PROJECT_WORKSPACE_FOLDER__: cwd
    }
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
