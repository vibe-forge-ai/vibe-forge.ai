import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'

import { glob } from 'fast-glob'
import fm from 'front-matter'

export interface Filter {
  include?: string[]
  exclude?: string[]
}

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

export interface Entity {
  name?: string
  always?: boolean
  description?: string
  tags?: string[]
  prompt?: string
  promptPath?: string
  rules?: string[]
  skills?: string[]
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
  private readonly cwd: string

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
  }

  private async scan(
    patterns: string[],
    cwd: string = this.cwd
  ): Promise<string[]> {
    return glob(patterns, { cwd, absolute: true })
  }

  async loadRules(rules: string[]) {
    return loadLocalDocuments<Rule>(
      await this.scan(rules)
    )
  }
  async loadDefaultRules(): Promise<Definition<Rule>[]> {
    return this.loadRules([
      '.ai/rules/*.md',
      '.ai/plugins/*/rules/*.md'
    ])
  }
  generateRulesPrompt(rules: Definition<Rule>[]): string {
    const rulesPrompt = rules
      .map((rule) => {
        const { path, body, attributes } = rule
        const name = attributes.name ?? basename(path)
        const desc = attributes.description ?? name
        return (
          `  - ${name}：${desc}\n` +
          `${attributes.always ? body : ''}\n` +
          '--------------------\n'
        )
      })
      .filter(Boolean)
      .join('\n')

    return (
      '<system-prompt>\n' +
      '项目系统规则如下：\n' +
      `${rulesPrompt}\n` +
      '</system-prompt>\n'
    )
  }

  async loadSkills(skills?: string[]): Promise<Definition<Skill>[]> {
    // 1. Scan for skills in standard locations
    // Project root skills: .ai/skills/{name}/SKILL.md
    // Plugin skills: .ai/plugins/{plugin}/skills/{name}/SKILL.md

    // Note: The user code uses readdir to iterate plugins.
    // We can use glob for easier path finding.

    const patterns = [
      '.ai/skills/*/SKILL.md',
      '.ai/plugins/*/skills/*/SKILL.md'
    ]

    let paths = await this.scan(patterns)

    // Filter by directory name (skill name)
    if (skills) {
      paths = paths.filter(path => {
        const parts = path.split('/')
        // .../skills/{name}/SKILL.md
        return skills.includes(parts[parts.length - 2])
      })
    }

    return loadLocalDocuments<Skill>(paths)
  }
  async loadDefaultSkills(): Promise<Definition<Skill>[]> {
    return this.loadSkills()
  }
  generateSkillsPrompt(skills: Definition<Skill>[]): string {
    return skills
      .map((skill) => {
        const { path, body } = skill
        return (
          '技能相关信息如下，通过阅读以下内容了解技能的详细信息：\n' +
          `- 技能文件资源路径：${dirname(path)}\n` +
          '- 资源内容：\n' +
          '<skill-content>\n' +
          `${body}\n` +
          '</skill-content>\n' +
          '资源内容中的文件路径相对「技能文件资源路径」路径，通过读取相关工具按照实际需要进行阅读。\n'
        )
      })
      .filter(Boolean)
      .join('\n')
  }
  generateSkillsRoutePrompt(skills: Definition<Skill>[]): string {
    return (
      '<skills>\n' +
      `${
        skills
          .filter(({ attributes: { always } }) => always !== false)
          .map(
            ({ attributes: { name, description } }) => `  - ${name}：${description}\n`
          )
          .join('')
      }\n` +
      '</skills>\n'
    )
  }

  async loadSpec(name: string): Promise<Definition<Spec> | undefined> {
    const patterns = [
      `.ai/specs/${name}.md`,
      `.ai/specs/${name}/index.md`,
      `.ai/plugins/*/specs/${name}.md`
    ]
    const paths = await this.scan(patterns)
    if (paths.length === 0) return undefined

    const projectPath = paths.find(p => p.includes('/.ai/specs/'))
    const targetPath = projectPath || paths[0]

    const [doc] = await loadLocalDocuments<Spec>([targetPath])
    return doc
  }
  async loadDefaultSpecs(): Promise<Definition<Spec>[]> {
    const patterns = [
      '.ai/specs/*.md',
      '.ai/specs/*/index.md',
      '.ai/plugins/*/specs/*.md',
      '.ai/plugins/*/specs/*/index.md'
    ]
    const paths = await this.scan(patterns)
    return loadLocalDocuments<Spec>(paths)
  }
  generateSpecRoutePrompt(specsDocuments: Definition<Spec>[]): string {
    const specsRouteStr = specsDocuments
      .filter(({ attributes }) => attributes.always !== false)
      .map(({ path, attributes }) => {
        const name = attributes.name ?? basename(dirname(path))
        const desc = attributes.description ?? name
        const params = attributes.params ?? []
        // Calculate relative path for display/ID
        // User code used relative('.ai/specs', path), but here path is absolute.
        // We can try to make it relative to cwd/.ai/specs if possible, or just relative to cwd.
        // The user code seems to assume specs are in .ai/specs.
        // Let's use relative(join(this.cwd, '.ai/specs'), path) if it's in there, otherwise...
        // Actually, just providing a relative path from project root is probably fine or the name.
        // User code: relative('.ai/specs', path)

        let relPath = relative(join(this.cwd, '.ai/specs'), path)
        if (relPath.startsWith('..')) {
          // Maybe in a plugin?
          relPath = relative(this.cwd, path)
        }

        return (
          `- 流程名称：${name}\n` +
          `  - 介绍：${desc}\n` +
          `  - 标识：${relPath}\n` +
          '  - 参数：\n' +
          `${
            params
              .map(({ name, description }) => `    - ${name}：${description}\n`)
              .join('')
          }\n`
        )
      })
      .join('\n')
    return (
      '<system-prompt>\n' +
      '你是一个专业的项目推进管理大师，能够熟练指导其他实体来为你的目标工作。对你的预期是：\n' +
      '\n' +
      '- 永远不要单独完成代码开发工作\n' +
      '- 必须要协调其他的开发人员来完成任务\n' +
      '- 必须让他们按照目标进行完成，不要偏离目标，检查他们任务完成后的汇报内容是否符合要求\n' +
      '\n' +
      '根据用户需要以及实际的开发目标来决定使用不同的工作流程，调用 `mcp__TmarAITools__load-spec` mcp tool 完成工作流程的加载。\n' +
      '- 根据实际需求传入标识，这不是路径，只能使用工具进行加载\n' +
      '- 通过参数的描述以及实际应用场景决定怎么传入参数\n' +
      '项目存在如下工作流程：\n' +
      `${specsRouteStr}\n` +
      '</system-prompt>\n'
    )
  }

  async loadEntity(name: string): Promise<Definition<Entity> | undefined> {
    // 1. Try to load from index.json (Directory based entity)
    const jsonPatterns = [
      `.ai/entities/${name}/index.json`,
      `.ai/plugins/*/entities/${name}/index.json`
    ]
    const jsonPaths = await this.scan(jsonPatterns)

    if (jsonPaths.length > 0) {
      const projectPath = jsonPaths.find(p => p.includes('/.ai/entities/'))
      const targetPath = projectPath || jsonPaths[0]
      return this.loadEntityFromJson(targetPath)
    }

    // 2. Fallback to Markdown file
    const patterns = [
      `.ai/entities/${name}/README.md`,
      `.ai/plugins/*/entities/${name}/README.md`
    ]
    const paths = await this.scan(patterns)
    if (paths.length === 0) return undefined

    const projectPath = paths.find(p => p.includes('/.ai/entities/'))
    const targetPath = projectPath || paths[0]

    const [doc] = await loadLocalDocuments<Entity>([targetPath])
    return doc
  }
  private async loadEntityFromJson(jsonPath: string): Promise<Definition<Entity>> {
    const entityDir = dirname(jsonPath)
    const jsonVariables: Record<string, string> = {
      workspaceFolder: process.env.WORKSPACE_FOLDER || this.cwd
    }

    const content = await readFile(jsonPath, 'utf-8')
    const entityJSONContent = content.replace(/\$\{([^}]+)\}/g, (_, key) => jsonVariables[key] ?? `$\{${key}}`)

    const entityData = JSON.parse(entityJSONContent) as Entity

    let prompt = entityData.prompt
    if (!prompt) {
      const promptPath = entityData.promptPath || 'AGENTS.md'
      const resolvedPromptPath = resolve(entityDir, promptPath)
      if (existsSync(resolvedPromptPath)) {
        prompt = await readFile(resolvedPromptPath, 'utf-8')
      }
    }

    return {
      path: jsonPath,
      body: prompt || '',
      attributes: entityData
    }
  }
  async loadDefaultEntities(): Promise<Definition<Entity>[]> {
    // List both .md and index.json entities
    const mdPatterns = [
      '.ai/entities/*.md',
      '.ai/plugins/*/entities/*.md'
    ]
    const jsonPatterns = [
      '.ai/entities/*/index.json',
      '.ai/plugins/*/entities/*/index.json'
    ]

    const [mdPaths, jsonPaths] = await Promise.all([
      this.scan(mdPatterns),
      this.scan(jsonPatterns)
    ])

    const mdDocs = await loadLocalDocuments<Entity>(mdPaths)
    const jsonDocs = await Promise.all(jsonPaths.map(p => this.loadEntityFromJson(p)))

    return [...mdDocs, ...jsonDocs]
  }
  generateEntitiesRoutePrompt(entities: Definition<Entity>[]): string {
    return (
      '<system-prompt>\n' +
      '项目存在如下实体：\n' +
      `${
        entities
          .map(({ attributes: { name, prompt: _p }, body }) => `  - ${name}：${body}\n`)
          .join('')
      }\n` +
      '解决用户问题时，需根据用户需求可以通过 run-tasks 工具指定为实体后，自行调度多个不同类型的实体来完成工作。\n' +
      '</system-prompt>\n'
    )
  }
}
