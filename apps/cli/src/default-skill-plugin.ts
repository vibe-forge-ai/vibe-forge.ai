import type { PluginConfig } from '@vibe-forge/types'

const CLI_DEFAULT_SKILL_PLUGIN_ID = '@vibe-forge/plugin-cli-skills'

const CLI_DEFAULT_SKILL_NAMES = [
  'vf-cli-quickstart',
  'vf-cli-print-mode'
] as const

export const getCliDefaultSkillPluginConfig = (): PluginConfig => [
  {
    id: CLI_DEFAULT_SKILL_PLUGIN_ID
  }
]

export const getCliDefaultSkillNames = () => [...CLI_DEFAULT_SKILL_NAMES]
