import { createRequire } from 'node:module'
import { dirname } from 'node:path'

import type { PluginConfig } from '@vibe-forge/types'

const CLI_DEFAULT_SKILL_PLUGIN_ID = '@vibe-forge/plugin-cli-skills'
const requireFromCliPackage = createRequire(__filename)

const CLI_DEFAULT_SKILL_NAMES = [
  'vf-cli-quickstart',
  'vf-cli-print-mode',
  'create-entity',
  'update-entity'
] as const

const resolveCliDefaultSkillPluginRoot = () => (
  dirname(requireFromCliPackage.resolve(`${CLI_DEFAULT_SKILL_PLUGIN_ID}/package.json`))
)

export const getCliDefaultSkillPluginConfig = (): PluginConfig => [
  {
    id: resolveCliDefaultSkillPluginRoot()
  }
]

export const getCliDefaultSkillNames = () => [...CLI_DEFAULT_SKILL_NAMES]
