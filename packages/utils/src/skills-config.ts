import type {
  Config,
  ConfiguredSkillInstallConfig,
  SkillHomeBridgeConfig,
  SkillsCliConfig
} from '@vibe-forge/types'

export interface LegacySkillsConfig {
  install?: Array<string | ConfiguredSkillInstallConfig>
  cli?: SkillsCliConfig
  homeBridge?: SkillHomeBridgeConfig
}

export const isLegacySkillsConfig = (value: Config['skills'] | undefined): value is LegacySkillsConfig => (
  value != null &&
  !Array.isArray(value) &&
  typeof value === 'object'
)

export const resolveConfiguredSkillInstalls = (
  skills: Config['skills'] | undefined
): Array<string | ConfiguredSkillInstallConfig> => (
  Array.isArray(skills) ? skills : (skills?.install ?? [])
)

export const resolveSkillsCliRuntimeConfig = (
  config: Pick<Config, 'skills' | 'skillsCli'> | undefined
): SkillsCliConfig | undefined => {
  const merged = {
    ...(isLegacySkillsConfig(config?.skills) ? (config.skills.cli ?? {}) : {}),
    ...(config?.skillsCli ?? {})
  } satisfies SkillsCliConfig

  return Object.keys(merged).length === 0 ? undefined : merged
}
