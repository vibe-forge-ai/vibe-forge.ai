import type {
  Config,
  ConfiguredSkillInstallConfig,
  SkillHomeBridgeConfig,
  SkillRegistryConfig
} from '@vibe-forge/types'

export interface LegacySkillsConfig {
  install?: Array<string | ConfiguredSkillInstallConfig>
  registry?: string | SkillRegistryConfig
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
