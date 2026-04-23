export interface SkillsCliListedSkill {
  description?: string
  name: string
}

export interface SkillsCliFindResult {
  installRef: string
  source: string
  skill: string
  installsLabel?: string
  url?: string
}

export interface InstalledSkillsCliSkill {
  description?: string
  dirName: string
  name: string
  sourcePath: string
}

export interface PublishSkillsCliResult {
  output: string
  stderr: string
  stdout: string
}
