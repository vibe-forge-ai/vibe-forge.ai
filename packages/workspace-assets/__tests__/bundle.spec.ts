/* eslint-disable max-lines -- bundle coverage keeps related fixture scenarios in one file */
import { join } from 'node:path'
import process from 'node:process'

import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'

const skillsCliMocks = vi.hoisted(() => ({
  findSkillsCli: vi.fn(),
  installSkillsCliRefToTemp: vi.fn(),
  installSkillsCliSkillToTemp: vi.fn()
}))

vi.mock('@vibe-forge/utils/skills-cli', async () => {
  const actual = await vi.importActual<typeof import('@vibe-forge/utils/skills-cli')>('@vibe-forge/utils/skills-cli')
  return {
    ...actual,
    findSkillsCli: skillsCliMocks.findSkillsCli,
    installSkillsCliRefToTemp: skillsCliMocks.installSkillsCliRefToTemp,
    installSkillsCliSkillToTemp: skillsCliMocks.installSkillsCliSkillToTemp
  }
})

import { buildAdapterAssetPlan, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, installPluginPackage, writeDocument } from './test-helpers'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('resolveWorkspaceAssetBundle', () => {
  it('loads npm plugin assets via the package-id fallback and exposes OpenCode overlays', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-demo',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/research/SKILL.md': '---\ndescription: 检索资料\n---\n阅读 README.md',
      'rules/review.md': '---\ndescription: 评审规则\n---\n必须检查风险',
      'mcp/browser.json': JSON.stringify({ command: 'npx', args: ['browser-server'] }, null, 2),
      'opencode/commands/review.md': '# review\n'
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-logger', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-logger',
          version: '1.0.0'
        },
        null,
        2
      ),
      'hooks.js': 'module.exports = {}\n'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'demo', scope: 'demo' },
          { id: 'logger' }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName)).toEqual(['demo/research'])
    expect(bundle.rules.map(asset => asset.displayName)).toEqual(['demo/review'])
    expect(Object.keys(bundle.mcpServers)).toEqual(['demo/browser'])
    expect(bundle.hookPlugins).toEqual(expect.arrayContaining([
      expect.objectContaining({
        packageId: '@vibe-forge/plugin-logger'
      })
    ]))
    expect(bundle.hookPlugins).toHaveLength(1)
    expect(bundle.opencodeOverlayAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'command',
        sourcePath: expect.stringContaining('/node_modules/@vibe-forge/plugin-demo/opencode/commands/review.md'),
        payload: expect.objectContaining({
          targetSubpath: 'commands/review.md'
        })
      })
    ]))
  })

  it('loads workspace assets from the env-configured ai base dir', async () => {
    const workspace = await createWorkspace()
    const previousBaseDir = process.env.__VF_PROJECT_AI_BASE_DIR__

    try {
      process.env.__VF_PROJECT_AI_BASE_DIR__ = '.vf'
      await writeDocument(join(workspace, '.vf/rules/review.md'), '---\ndescription: 评审规则\n---\n必须检查风险')
      await writeDocument(
        join(workspace, '.vf/skills/research/SKILL.md'),
        '---\ndescription: 检索资料\n---\n阅读 README.md'
      )

      const bundle = await resolveWorkspaceAssetBundle({
        cwd: workspace,
        configs: [undefined, undefined],
        useDefaultVibeForgeMcpServer: false
      })

      expect(bundle.rules.map(asset => asset.displayName)).toEqual(['review'])
      expect(bundle.skills.map(asset => asset.displayName)).toEqual(['research'])
    } finally {
      if (previousBaseDir == null) {
        delete process.env.__VF_PROJECT_AI_BASE_DIR__
      } else {
        process.env.__VF_PROJECT_AI_BASE_DIR__ = previousBaseDir
      }
    }
  })

  it('loads local and dev rule files as workspace rules', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/rules/team.md'),
      '---\ndescription: 团队规则\n---\n团队共享约束'
    )
    await writeDocument(
      join(workspace, '.ai/rules/preference.local.md'),
      '---\ndescription: 本地偏好\nalwaysApply: true\n---\n使用当前用户偏好的输出风格'
    )
    await writeDocument(
      join(workspace, '.ai/rules/debug.dev.md'),
      '---\ndescription: 本地调试\nalwaysApply: true\n---\n优先保留调试证据'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.rules.map(asset => asset.displayName).sort()).toEqual(['debug.dev', 'preference.local', 'team'])
    expect(bundle.rules.find(asset => asset.displayName === 'preference.local')?.payload.definition.body)
      .toContain('当前用户偏好')
    expect(bundle.rules.find(asset => asset.displayName === 'debug.dev')?.payload.definition.attributes.alwaysApply)
      .toBe(true)
  })

  it('bridges supported home skill roots by default and keeps the first duplicate root', async () => {
    const workspace = await createWorkspace()
    const realHome = process.env.__VF_PROJECT_REAL_HOME__

    await writeDocument(
      join(realHome!, '.agents/skills/research/SKILL.md'),
      '---\ndescription: 来自 agents root\n---\n阅读 README.md'
    )
    await writeDocument(
      join(realHome!, '.claude/skills/research/SKILL.md'),
      '---\ndescription: 来自 claude root\n---\n这份定义应被后面的 root 覆盖掉'
    )
    await writeDocument(
      join(realHome!, '.config/opencode/skills/release/SKILL.md'),
      '---\ndescription: 来自 opencode root\n---\n整理发布材料'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName)).toEqual(['research', 'release'])
    expect(bundle.skills.find(asset => asset.name === 'research')).toEqual(expect.objectContaining({
      origin: 'workspace',
      resolvedBy: 'home-bridge',
      sourcePath: join(realHome!, '.agents/skills/research/SKILL.md')
    }))
    expect(bundle.skills.find(asset => asset.name === 'release')).toEqual(expect.objectContaining({
      origin: 'workspace',
      resolvedBy: 'home-bridge',
      sourcePath: join(realHome!, '.config/opencode/skills/release/SKILL.md')
    }))
  })

  it('can disable the home skill bridge entirely', async () => {
    const workspace = await createWorkspace()
    const realHome = process.env.__VF_PROJECT_REAL_HOME__

    await writeDocument(
      join(realHome!, '.agents/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: {
          homeBridge: {
            enabled: false
          }
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills).toEqual([])
  })

  it('supports custom home skill roots with tilde expansion', async () => {
    const workspace = await createWorkspace()
    const realHome = process.env.__VF_PROJECT_REAL_HOME__

    await writeDocument(
      join(realHome!, '.agents/skills/ignored/SKILL.md'),
      '---\ndescription: 默认目录\n---\n这份定义不应被加载'
    )
    await writeDocument(
      join(realHome!, 'custom-skills/writer/SKILL.md'),
      '---\ndescription: 自定义目录\n---\n产出说明文档'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: {
          homeBridge: {
            roots: '~/custom-skills'
          }
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName)).toEqual(['writer'])
    expect(bundle.skills[0]?.sourcePath).toBe(join(realHome!, 'custom-skills/writer/SKILL.md'))
    expect(bundle.skills[0]?.resolvedBy).toBe('home-bridge')
  })

  it('keeps the first matching skill when multiple homeBridge roots contain the same name', async () => {
    const workspace = await createWorkspace()
    const realHome = process.env.__VF_PROJECT_REAL_HOME__

    await writeDocument(
      join(realHome!, '.claude/skills/research/SKILL.md'),
      '---\ndescription: 来自 claude root\n---\n优先保留这份定义'
    )
    await writeDocument(
      join(realHome!, '.agents/skills/research/SKILL.md'),
      '---\ndescription: 来自 agents root\n---\n这份定义应被后面的 root 跳过'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: {
          homeBridge: {
            roots: ['~/.claude/skills', '~/.agents/skills']
          }
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName)).toEqual(['research'])
    expect(bundle.skills[0]).toEqual(expect.objectContaining({
      origin: 'workspace',
      resolvedBy: 'home-bridge',
      sourcePath: join(realHome!, '.claude/skills/research/SKILL.md')
    }))
  })

  it('warns once when a custom homeBridge root uses an unsupported relative path', async () => {
    const workspace = await createWorkspace()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      const bundle = await resolveWorkspaceAssetBundle({
        cwd: workspace,
        configs: [{
          skills: {
            homeBridge: {
              roots: ['./team-skills']
            }
          }
        }, undefined],
        useDefaultVibeForgeMcpServer: false
      })

      expect(bundle.skills).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring invalid skills.homeBridge root "./team-skills"')
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('lets project and plugin skills override matching home-bridged skills', async () => {
    const workspace = await createWorkspace()
    const realHome = process.env.__VF_PROJECT_REAL_HOME__

    await writeDocument(
      join(realHome!, '.agents/skills/research/SKILL.md'),
      '---\ndescription: home research\n---\nhome research body'
    )
    await writeDocument(
      join(realHome!, '.agents/skills/review/SKILL.md'),
      '---\ndescription: home review\n---\nhome review body'
    )
    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: project research\n---\nproject research body'
    )
    await installPluginPackage(workspace, '@vibe-forge/plugin-review', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-review',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/review/SKILL.md': '---\ndescription: plugin review\n---\nplugin review body'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'review' }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName).sort()).toEqual(['research', 'review'])
    expect(bundle.skills.find(asset => asset.name === 'research')).toEqual(expect.objectContaining({
      sourcePath: join(workspace, '.ai/skills/research/SKILL.md'),
      resolvedBy: undefined
    }))
    expect(bundle.skills.find(asset => asset.name === 'review')).toEqual(expect.objectContaining({
      origin: 'plugin',
      sourcePath: expect.stringContaining('/node_modules/@vibe-forge/plugin-review/skills/review/SKILL.md')
    }))
  })

  it('keeps scoped project skills alongside unscoped home skills with the same base name', async () => {
    const workspace = await createWorkspace()
    const realHome = process.env.__VF_PROJECT_REAL_HOME__

    await writeDocument(
      join(realHome!, '.agents/skills/research/SKILL.md'),
      '---\ndescription: home research\n---\nhome research body'
    )
    await installPluginPackage(workspace, '@vibe-forge/plugin-team', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-team',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/research/SKILL.md': '---\ndescription: scoped research\n---\nscoped research body'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'team', scope: 'team' }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName).sort()).toEqual(['research', 'team/research'])
    expect(bundle.skills.find(asset => asset.displayName === 'research')).toEqual(expect.objectContaining({
      resolvedBy: 'home-bridge'
    }))
    expect(bundle.skills.find(asset => asset.displayName === 'team/research')).toEqual(expect.objectContaining({
      origin: 'plugin'
    }))
  })

  it('installs selected missing skill dependencies from the skills CLI cache', async () => {
    const workspace = await createWorkspace()
    const realHome = process.env.__VF_PROJECT_REAL_HOME__
    const tempInstallDir = join(workspace, '.tmp-install-skills-cli')
    const installedSkillDir = join(tempInstallDir, '.agents', 'skills', 'frontend-design')
    await writeDocument(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: frontend-design\ndescription: UI design guidance\n---\nUse strong visual hierarchy.\n'
    )
    skillsCliMocks.installSkillsCliSkillToTemp.mockResolvedValue({
      tempDir: tempInstallDir,
      installedSkill: {
        dirName: 'frontend-design',
        name: 'frontend-design',
        sourcePath: installedSkillDir
      }
    })

    await writeDocument(
      join(realHome!, '.agents/skills/frontend-design/SKILL.md'),
      '---\ndescription: home frontend design\n---\nUse the home definition.'
    )
    await writeDocument(
      join(workspace, '.ai/skills/app-builder/SKILL.md'),
      [
        '---',
        'name: app-builder',
        'description: Build apps',
        'dependencies:',
        '  - anthropics/skills@frontend-design',
        '---',
        'Build the app.'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.name).sort()).toEqual(['app-builder', 'frontend-design'])
    expect(bundle.skills.find(asset => asset.name === 'frontend-design')).toEqual(expect.objectContaining({
      resolvedBy: 'home-bridge',
      sourcePath: join(realHome!, '.agents/skills/frontend-design/SKILL.md')
    }))

    await buildAdapterAssetPlan({
      adapter: 'opencode',
      bundle,
      options: {
        skills: {
          include: ['app-builder']
        }
      }
    })

    const dependency = bundle.skills.find(asset => asset.name === 'frontend-design')
    expect(bundle.skills.map(asset => asset.name).sort()).toEqual(['app-builder', 'frontend-design'])
    expect(dependency?.sourcePath).toContain(
      '/.ai/caches/skill-dependencies/skills-cli/skills/latest/default/anthropics/skills/frontend-design/'
    )
    expect(bundle.skills.find(asset => (
      asset.name === 'frontend-design' && asset.resolvedBy === 'home-bridge'
    ))).toBeUndefined()
    expect(skillsCliMocks.findSkillsCli).not.toHaveBeenCalled()
    expect(skillsCliMocks.installSkillsCliSkillToTemp).toHaveBeenCalledWith({
      config: undefined,
      skill: 'frontend-design',
      source: 'anthropics/skills'
    })
  })

  it('installs configured project skills before bundle resolution and rewrites renamed skill names', async () => {
    const workspace = await createWorkspace()
    const tempInstallDir = join(workspace, '.tmp-configured-install')
    const installedSkillDir = join(tempInstallDir, '.agents', 'skills', 'design-review')
    await writeDocument(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: design-review\ndescription: Review design work\n---\nReview the UI implementation.\n'
    )
    skillsCliMocks.installSkillsCliSkillToTemp.mockResolvedValue({
      tempDir: tempInstallDir,
      installedSkill: {
        dirName: 'design-review',
        name: 'design-review',
        sourcePath: installedSkillDir
      }
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: [
          {
            name: 'design-review',
            source: 'example-source/default/public',
            rename: 'internal-review'
          }
        ]
      }, undefined],
      syncConfiguredSkills: true,
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.name)).toContain('internal-review')
    expect(skillsCliMocks.installSkillsCliSkillToTemp).toHaveBeenCalledWith({
      config: undefined,
      skill: 'design-review',
      source: 'example-source/default/public'
    })
    await expect(readFile(join(workspace, '.ai/skills/internal-review/SKILL.md'), 'utf8')).resolves.toContain(
      'name: internal-review'
    )
  })

  it('skips configured skill reinstalls unless updateConfiguredSkills is enabled', async () => {
    const workspace = await createWorkspace()
    await writeDocument(
      join(workspace, '.ai/skills/internal-review/SKILL.md'),
      '---\nname: internal-review\ndescription: Existing skill\n---\nExisting content.\n'
    )

    const skippedBundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: [
          {
            name: 'design-review',
            source: 'example-source/default/public',
            rename: 'internal-review'
          }
        ]
      }, undefined],
      syncConfiguredSkills: true,
      useDefaultVibeForgeMcpServer: false
    })

    expect(skippedBundle.skills.map(asset => asset.name)).toContain('internal-review')
    expect(skillsCliMocks.installSkillsCliSkillToTemp).not.toHaveBeenCalled()

    const tempInstallDir = join(workspace, '.tmp-configured-update')
    const installedSkillDir = join(tempInstallDir, '.agents', 'skills', 'design-review')
    await writeDocument(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: design-review\ndescription: Updated skill\n---\nUpdated content.\n'
    )
    skillsCliMocks.installSkillsCliSkillToTemp.mockResolvedValueOnce({
      tempDir: tempInstallDir,
      installedSkill: {
        dirName: 'design-review',
        name: 'design-review',
        sourcePath: installedSkillDir
      }
    })

    await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: [
          {
            name: 'design-review',
            source: 'example-source/default/public',
            rename: 'internal-review'
          }
        ]
      }, undefined],
      syncConfiguredSkills: true,
      updateConfiguredSkills: true,
      useDefaultVibeForgeMcpServer: false
    })

    expect(skillsCliMocks.installSkillsCliSkillToTemp).toHaveBeenCalledTimes(1)
    await expect(readFile(join(workspace, '.ai/skills/internal-review/SKILL.md'), 'utf8')).resolves.toContain(
      'Updated content.'
    )
  })

  it('installs skill dependencies into the primary workspace shared cache', async () => {
    const primary = await createWorkspace()
    const worktree = await createWorkspace()
    const previousPrimaryWorkspace = process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__
    const tempInstallDir = join(worktree, '.tmp-install-skills-cli')
    const installedSkillDir = join(tempInstallDir, '.agents', 'skills', 'frontend-design')
    await writeDocument(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: frontend-design\ndescription: UI design guidance\n---\nUse primary cache.\n'
    )
    skillsCliMocks.installSkillsCliSkillToTemp.mockResolvedValue({
      tempDir: tempInstallDir,
      installedSkill: {
        dirName: 'frontend-design',
        name: 'frontend-design',
        sourcePath: installedSkillDir
      }
    })

    try {
      process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = primary
      await writeDocument(
        join(worktree, '.ai/skills/app-builder/SKILL.md'),
        [
          '---',
          'name: app-builder',
          'description: Build apps',
          'dependencies:',
          '  - anthropics/skills@frontend-design',
          '---',
          'Build the app.'
        ].join('\n')
      )

      const bundle = await resolveWorkspaceAssetBundle({
        cwd: worktree,
        configs: [undefined, undefined],
        useDefaultVibeForgeMcpServer: false
      })

      await buildAdapterAssetPlan({
        adapter: 'opencode',
        bundle,
        options: {
          skills: {
            include: ['app-builder']
          }
        }
      })

      const dependency = bundle.skills.find(asset => asset.name === 'frontend-design')
      expect(dependency?.sourcePath).toContain(join(
        primary,
        '.ai/caches/skill-dependencies/skills-cli/skills/latest/default/anthropics/skills/frontend-design/'
      ))
      expect(dependency?.sourcePath).not.toContain(join(worktree, '.ai/caches'))
    } finally {
      if (previousPrimaryWorkspace == null) {
        delete process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__
      } else {
        process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = previousPrimaryWorkspace
      }
    }
  })

  it('reuses complete skill dependency caches without deleting or downloading them again', async () => {
    const workspace = await createWorkspace()

    const cachedSkillPath = join(
      workspace,
      '.ai/caches/skill-dependencies/skills-cli/skills/latest/default/anthropics/skills/frontend-design/SKILL.md'
    )
    await writeDocument(
      cachedSkillPath,
      '---\nname: frontend-design\ndescription: Cached UI guidance\n---\nUse the cached copy.\n'
    )
    await writeDocument(
      join(workspace, '.ai/skills/app-builder/SKILL.md'),
      [
        '---',
        'name: app-builder',
        'description: Build apps',
        'dependencies:',
        '  - anthropics/skills@frontend-design',
        '---',
        'Build the app.'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    await buildAdapterAssetPlan({
      adapter: 'opencode',
      bundle,
      options: {
        skills: {
          include: ['app-builder']
        }
      }
    })

    expect(skillsCliMocks.findSkillsCli).not.toHaveBeenCalled()
    expect(skillsCliMocks.installSkillsCliSkillToTemp).not.toHaveBeenCalled()
    expect(await readFile(cachedSkillPath, 'utf8')).toContain('Use the cached copy.')
    expect(bundle.skills.map(asset => asset.name).sort()).toEqual(['app-builder', 'frontend-design'])
  })

  it('parses multi-segment source dependencies and forwards skillsCli runtime config', async () => {
    const workspace = await createWorkspace()
    const tempInstallDir = join(workspace, '.tmp-install-skills-cli')
    const installedSkillDir = join(tempInstallDir, '.agents', 'skills', 'frontend-design')
    await writeDocument(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: frontend-design\ndescription: UI design guidance\n---\nUse internal design tokens.\n'
    )
    skillsCliMocks.installSkillsCliSkillToTemp.mockResolvedValue({
      tempDir: tempInstallDir,
      installedSkill: {
        dirName: 'frontend-design',
        name: 'frontend-design',
        sourcePath: installedSkillDir
      }
    })

    await writeDocument(
      join(workspace, '.ai/skills/app-builder/SKILL.md'),
      [
        '---',
        'name: app-builder',
        'description: Build apps',
        'dependencies:',
        '  - example-source/default/public/frontend-design',
        '---',
        'Build the app.'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skillsCli: {
          registry: 'https://registry.example.com'
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    await buildAdapterAssetPlan({
      adapter: 'opencode',
      bundle,
      options: {
        skills: {
          include: ['app-builder']
        }
      }
    })

    expect(skillsCliMocks.installSkillsCliSkillToTemp).toHaveBeenCalledWith({
      config: {
        registry: 'https://registry.example.com'
      },
      skill: 'frontend-design',
      source: 'example-source/default/public'
    })
  })

  it('loads workspace entities from the env-configured entities dir', async () => {
    const workspace = await createWorkspace()
    const previousEntitiesDir = process.env.__VF_PROJECT_AI_ENTITIES_DIR__

    try {
      process.env.__VF_PROJECT_AI_ENTITIES_DIR__ = 'agents'
      await writeDocument(
        join(workspace, '.ai/agents/reviewer/README.md'),
        '---\ndescription: 负责代码评审\n---\n检查风险'
      )

      const bundle = await resolveWorkspaceAssetBundle({
        cwd: workspace,
        configs: [undefined, undefined],
        useDefaultVibeForgeMcpServer: false
      })

      expect(bundle.entities.map(asset => asset.displayName)).toEqual(['reviewer'])
      expect(bundle.entities[0]?.sourcePath).toContain('/.ai/agents/reviewer/README.md')
    } finally {
      if (previousEntitiesDir == null) {
        delete process.env.__VF_PROJECT_AI_ENTITIES_DIR__
      } else {
        process.env.__VF_PROJECT_AI_ENTITIES_DIR__ = previousEntitiesDir
      }
    }
  })

  it('auto-loads managed Claude plugins from .ai/plugins as directory plugins', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/plugins/demo/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: 'demo',
          scope: 'demo',
          installedAt: new Date().toISOString(),
          source: {
            type: 'path',
            path: './demo'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/vibe-forge/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/vibe-forge/mcp/browser.json'),
      JSON.stringify({ command: 'npx', args: ['browser-server'] }, null, 2)
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/vibe-forge/hooks.js'),
      'module.exports = { name: "demo-managed" }\n'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName)).toContain('demo/research')
    expect(Object.keys(bundle.mcpServers)).toContain('demo/browser')
    expect(bundle.hookPlugins).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'demo',
        origin: 'plugin'
      })
    ]))
  })

  it('adds the built-in Vibe Forge MCP server when enabled and omits it when disabled', async () => {
    const workspace = await createWorkspace()

    const enabledBundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: true
    })

    expect(enabledBundle.mcpServers).toHaveProperty('VibeForge')
    expect(enabledBundle.mcpServers.VibeForge?.payload.config).toEqual(expect.objectContaining({
      command: process.execPath,
      args: [expect.stringMatching(/packages\/mcp\/cli\.js$/)]
    }))

    const disabledBundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(disabledBundle.mcpServers).not.toHaveProperty('VibeForge')
  })

  it('discovers configured workspaces from glob patterns and entries', async () => {
    const workspace = await createWorkspace()

    await writeDocument(join(workspace, 'services/billing/README.md'), '# billing\n')
    await writeDocument(join(workspace, 'services/legacy/README.md'), '# legacy\n')
    await writeDocument(join(workspace, 'docs/README.md'), '# docs\n')

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        workspaces: {
          include: ['services/*'],
          exclude: ['services/legacy'],
          entries: {
            docs: {
              path: 'docs',
              description: 'Documentation workspace'
            }
          }
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.workspaces.map(asset => asset.displayName)).toEqual(['billing', 'docs'])
    expect(bundle.workspaces.map(asset => asset.payload)).toEqual([
      expect.objectContaining({
        id: 'billing',
        path: 'services/billing'
      }),
      expect.objectContaining({
        id: 'docs',
        path: 'docs',
        description: 'Documentation workspace'
      })
    ])
  })

  it('skips disabled plugin instances and lets disabled child overrides suppress default child activation', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-demo',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/research/SKILL.md': '---\ndescription: 检索资料\n---\n阅读 README.md'
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-bundle', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-bundle',
          version: '1.0.0'
        },
        null,
        2
      ),
      'index.js': [
        'module.exports = {',
        '  __vibeForgePluginManifest: true,',
        '  children: {',
        '    review: {',
        '      source: { type: "package", id: "@vibe-forge/plugin-review" },',
        '      activation: "default"',
        '    }',
        '  }',
        '}',
        ''
      ].join('\n')
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-review', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-review',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/audit/SKILL.md': '---\ndescription: 代码审计\n---\n检查 child plugin 是否启用'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'demo', scope: 'demo', enabled: false },
          {
            id: 'bundle',
            scope: 'bundle',
            children: [
              { id: 'review', enabled: false }
            ]
          }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills).toEqual([])
    expect(bundle.pluginInstances.map(instance => instance.packageId)).toEqual(['@vibe-forge/plugin-bundle'])
  })

  it('lets later config layers disable matching plugin instances by id and scope', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-logger', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-logger',
          version: '1.0.0'
        },
        null,
        2
      ),
      'hooks.js': 'module.exports = {}\n'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [
        {
          plugins: [
            { id: 'logger' }
          ]
        },
        {
          plugins: [
            { id: 'logger', enabled: false }
          ]
        }
      ],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.pluginConfigs).toEqual([
      { id: 'logger', enabled: false }
    ])
    expect(bundle.pluginInstances).toEqual([])
    expect(bundle.hookPlugins).toEqual([])
  })

  it('surfaces invalid plugin manifests instead of silently falling back to directory scanning', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-bad-manifest', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-bad-manifest',
          version: '1.0.0',
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
        '  scope: "bad",',
        '  assets: {',
        '    skills: "./custom-skills"',
        '  }',
        '}',
        ''
      ].join('\n'),
      'custom-skills/research/SKILL.md': '---\ndescription: 检索资料\n---\n阅读 README.md'
    })

    await expect(resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: '@vibe-forge/plugin-bad-manifest' }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })).rejects.toThrow('Failed to load plugin manifest for @vibe-forge/plugin-bad-manifest')
  })
})
