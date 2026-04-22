export interface ProjectSkillSummary {
  description?: string
  dirName: string
  name: string
}

export interface NormalizedProjectSkillInstall {
  ref: string
  name: string
  rename?: string
  source?: string
  targetName: string
  targetDirName: string
}

export interface ResolvedProjectSkillPublishSpec {
  kind: 'path' | 'project' | 'remote'
  requested: string
  skillSpec: string
  dirName?: string
  name?: string
}
