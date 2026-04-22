import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DefinitionLoader } from '#~/index.js'

const tempDirs: string[] = []
const originalRealHome = process.env.__VF_PROJECT_REAL_HOME__

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'definition-loader-'))
  const realHome = await mkdtemp(join(tmpdir(), 'definition-loader-home-'))
  tempDirs.push(dir)
  tempDirs.push(realHome)
  process.env.__VF_PROJECT_REAL_HOME__ = realHome
  return dir
}

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

const installPluginPackage = async (workspace: string, packageName: string, files: Record<string, string>) => {
  const packageDir = join(workspace, 'node_modules', ...packageName.split('/'))
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      await writeDocument(join(packageDir, relativePath), content)
    })
  )
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  if (originalRealHome == null) {
    delete process.env.__VF_PROJECT_REAL_HOME__
  } else {
    process.env.__VF_PROJECT_REAL_HOME__ = originalRealHome
  }
})

describe('definitionLoader', () => {
  it('loads local and remote rule references with overridden descriptions', async () => {
    const workspace = await createWorkspace()
    const loader = new DefinitionLoader(workspace)
    const baseDir = join(workspace, '.ai/entities/api-developer')

    await writeDocument(
      join(baseDir, 'rules/migrate.md'),
      '---\ndescription: 文件内描述\n---\n遵循新的 API 迁移流程'
    )

    const rules = await loader.loadRules(
      [
        {
          path: './rules/migrate.md',
          desc: '迁移老范式的 API 代码到新范式'
        },
        {
          type: 'remote',
          tags: ['business', 'api-develop']
        }
      ],
      { baseDir }
    )

    expect(rules).toHaveLength(2)
    expect(rules[0]?.path).toBe(join(baseDir, 'rules/migrate.md'))
    expect(rules[0]?.attributes.description).toBe('迁移老范式的 API 代码到新范式')
    expect(rules[1]?.path).toBe('remote-rule-2.md')
    expect(rules[1]?.body).toContain('Knowledge base tags: business, api-develop')
  })

  it('loads and filters workspace skills by logical name', async () => {
    const workspace = await createWorkspace()
    const loader = new DefinitionLoader(workspace)
    const realHome = process.env.__VF_PROJECT_REAL_HOME__

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      '---\ndescription: 代码评审\n---\n检查风险'
    )
    await writeDocument(
      join(realHome!, '.agents/skills/home-bridge/SKILL.md'),
      '---\ndescription: 来自 home\n---\n整理本地偏好'
    )

    const allSkills = await loader.loadDefaultSkills()
    const selectedSkills = await loader.loadSkills(['review'])

    expect(allSkills.map(skill => skill.resolvedName)).toEqual(['research', 'review', 'home-bridge'])
    expect(allSkills.map(skill => skill.resolvedSource)).toEqual(['project', 'project', 'home'])
    expect(selectedSkills.map(skill => skill.resolvedName)).toEqual(['review'])
  })

  it('loads npm plugin specs and README based entities consistently', async () => {
    const workspace = await createWorkspace()
    const loader = new DefinitionLoader(workspace)

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: [
          {
            id: 'demo'
          }
        ]
      })
    )
    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-demo',
          exports: {
            '.': './index.js'
          }
        },
        null,
        2
      ),
      'index.js': [
        'module.exports = {',
        '  __vibeForgePluginManifest: true,',
        '  assets: {',
        '    specs: "./specs"',
        '  }',
        '};',
        ''
      ].join('\n'),
      'specs/ship/index.md': '---\ndescription: 插件发布流程\n---\n执行插件发布'
    })
    await writeDocument(
      join(workspace, '.ai/entities/reviewer/README.md'),
      '---\ndescription: 代码审查实体\n---\n负责代码审查'
    )
    await writeDocument(
      join(workspace, '.ai/entities/planner.md'),
      '---\ndescription: 任务规划实体\n---\n负责拆解任务'
    )

    const pluginSpec = await loader.loadSpec('ship')
    const reviewer = await loader.loadEntity('reviewer')
    const planner = await loader.loadEntity('planner')
    const entities = await loader.loadDefaultEntities()

    expect(pluginSpec?.path).toContain('/node_modules/@vibe-forge/plugin-demo/specs/ship/index.md')
    expect(reviewer?.path).toContain('/.ai/entities/reviewer/README.md')
    expect(planner?.path).toContain('/.ai/entities/planner.md')
    expect(entities.map((entity: (typeof entities)[number]) => entity.path)).toEqual([
      join(workspace, '.ai/entities/planner.md'),
      join(workspace, '.ai/entities/reviewer/README.md')
    ])
  })
})
