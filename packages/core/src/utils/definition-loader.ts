import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { glob } from 'fast-glob'
import fm from 'front-matter'

export interface Rule {
  name?: string
  description?: string
  /**
   * 是否默认加载至系统上下文
   */
  always?: boolean
}

export interface Spec {
  name?: string
  always?: boolean
  description?: string
  params?: {
    name: string
    description?: string
  }[]
  skills?: {
    include?: string[]
    exclude?: string[]
  }
  mcpServers?: {
    include?: string[]
    exclude?: string[]
  }
  tools?: {
    include?: string[]
    exclude?: string[]
  }
}

export interface Entity {
  name?: string
  always?: boolean
  description?: string
  prompt?: string
  skills?: {
    include?: string[]
    exclude?: string[]
  }
  mcpServers?: {
    include?: string[]
    exclude?: string[]
  }
  tools?: {
    include?: string[]
    exclude?: string[]
  }
}

export interface Skill {
  name?: string
  description?: string
}

export interface Definition<T> {
  path: string
  body: string
  attributes: T
}

/**
 * 以结构化的方式加载本地文档数据
 */
export const loadLocalDocuments = async <Attrs extends object>(
  paths: string[]
): Promise<Definition<Attrs>[]> => {
  const promises = paths.map(async (path) => {
    const content = await readFile(path, 'utf-8')
    const { body, attributes } = fm<Attrs>(content)
    return {
      path,
      body,
      attributes
    }
  })
  return Promise.all(promises)
}

export class DefinitionLoader {
  private cwd: string

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
  }

  private async scan(
    patterns: string[],
    cwd: string = this.cwd
  ): Promise<string[]> {
    return glob(patterns, { cwd, absolute: true })
  }

  async loadRules(): Promise<Definition<Rule>[]> {
    const patterns = [
      '.ai/rules/*.md',
      '.ai/plugins/*/rules/*.md'
    ]
    const paths = await this.scan(patterns)
    return loadLocalDocuments<Rule>(paths)
  }

  async loadSpec(name: string): Promise<Definition<Spec> | undefined> {
    const patterns = [
      `.ai/specs/${name}.md`,
      `.ai/plugins/*/specs/${name}.md`
    ]
    const paths = await this.scan(patterns)
    if (paths.length === 0) return undefined
    
    // Priority: Project root > Plugin
    // Since we scan both, if there's a conflict, we might need a strategy.
    // For now, take the first one found (glob order).
    // Better strategy: sort by path length or explicit priority.
    // Given the pattern order in fast-glob isn't strictly guaranteed across multiple patterns unless sorted,
    // let's assume we want project root first.
    
    const projectPath = paths.find(p => p.includes('/.ai/specs/'))
    const targetPath = projectPath || paths[0]
    
    const [doc] = await loadLocalDocuments<Spec>([targetPath])
    return doc
  }

  async listSpecs(): Promise<Definition<Spec>[]> {
    const patterns = [
      '.ai/specs/*.md',
      '.ai/plugins/*/specs/*.md'
    ]
    const paths = await this.scan(patterns)
    return loadLocalDocuments<Spec>(paths)
  }

  async loadEntity(name: string): Promise<Definition<Entity> | undefined> {
    const patterns = [
      `.ai/entities/${name}.md`,
      `.ai/plugins/*/entities/${name}.md`
    ]
    const paths = await this.scan(patterns)
    if (paths.length === 0) return undefined
    
    const projectPath = paths.find(p => p.includes('/.ai/entities/'))
    const targetPath = projectPath || paths[0]
    
    const [doc] = await loadLocalDocuments<Entity>([targetPath])
    return doc
  }

  async listEntities(): Promise<Definition<Entity>[]> {
    const patterns = [
      '.ai/entities/*.md',
      '.ai/plugins/*/entities/*.md'
    ]
    const paths = await this.scan(patterns)
    return loadLocalDocuments<Entity>(paths)
  }
  
  async listSkills(): Promise<Definition<Skill>[]> {
     const patterns = [
       '.ai/skills/*.md',
       '.ai/plugins/*/skills/*.md'
     ]
     const paths = await this.scan(patterns)
     return loadLocalDocuments<Skill>(paths)
  }
}
