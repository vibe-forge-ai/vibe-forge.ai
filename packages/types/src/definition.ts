export interface Filter {
  include?: string[]
  exclude?: string[]
}

export interface Rule {
  name?: string
  description?: string
  globs?: string | string[]
  always?: boolean
}

export interface Spec {
  name?: string
  always?: boolean
  description?: string
  tags?: string[]
  params?: {
    name: string
    description?: string
  }[]
  rules?: string[]
  skills?: string[]
  mcpServers?: Filter
  tools?: Filter
}

export interface LocalRuleReference {
  type?: 'local'
  path: string
  desc?: string
}

export interface RemoteRuleReference {
  type: 'remote'
  tags?: string[]
  desc?: string
}

export type RuleReference = string | LocalRuleReference | RemoteRuleReference

export interface SkillSelection {
  type: 'include' | 'exclude'
  list: string[]
}

export interface Entity {
  name?: string
  always?: boolean
  description?: string
  tags?: string[]
  prompt?: string
  promptPath?: string
  rules?: RuleReference[]
  skills?: string[] | SkillSelection
  mcpServers?: Filter
  tools?: Filter
}

export interface Skill {
  name?: string
  description?: string
  always?: boolean
}

export interface Definition<T> {
  path: string
  body: string
  attributes: T
}
