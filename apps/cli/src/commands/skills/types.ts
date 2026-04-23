export const CONFIG_WRITE_SOURCES = ['project', 'user'] as const
export const CONFIG_REMOVE_SOURCES = ['project', 'user', 'all'] as const

export type ConfigWriteSource = typeof CONFIG_WRITE_SOURCES[number]
export type ConfigRemoveSource = typeof CONFIG_REMOVE_SOURCES[number]

export interface SkillsInstallOptions {
  force?: boolean
  json?: boolean
  registry?: string
  rename?: string
  source?: string
  version?: string
}

export interface SkillsAddOptions extends SkillsInstallOptions {
  configSource?: ConfigWriteSource
}

export interface SkillsRemoveOptions {
  configSource?: ConfigRemoveSource
  json?: boolean
  keepFiles?: boolean
}

export interface SkillsPublishOptions {
  access?: string
  group?: boolean | string
  json?: boolean
  region?: string
  registry?: string
  yes?: boolean
}
