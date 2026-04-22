/* eslint-disable import/first -- hoisted vitest mocks must be declared before importing the bundle entrypoint */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path, { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findSkillsCli: vi.fn(),
  installSkillsCliRefToTemp: vi.fn(),
  installSkillsCliSkillToTemp: vi.fn()
}))

vi.mock('@vibe-forge/utils/skills-cli', async () => {
  const actual = await vi.importActual<typeof import('@vibe-forge/utils/skills-cli')>('@vibe-forge/utils/skills-cli')
  return {
    ...actual,
    findSkillsCli: mocks.findSkillsCli,
    installSkillsCliRefToTemp: mocks.installSkillsCliRefToTemp,
    installSkillsCliSkillToTemp: mocks.installSkillsCliSkillToTemp
  }
})

import { buildAdapterAssetPlan, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, writeDocument } from './test-helpers'

describe('skills CLI dependency resolution', () => {
  let installWorkspace: string

  beforeEach(async () => {
    installWorkspace = await mkdtemp(path.join(os.tmpdir(), 'vf-skills-cli-dependency-'))
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(installWorkspace, { recursive: true, force: true })
  })

  it('installs missing bare-name dependencies through skills CLI by default', async () => {
    const workspace = await createWorkspace()
    const installedSkillDir = join(installWorkspace, '.agents', 'skills', 'frontend-design')
    await mkdir(installedSkillDir, { recursive: true })
    await writeFile(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: frontend-design\ndescription: UI design guidance\n---\nUse strong visual hierarchy.\n'
    )

    mocks.findSkillsCli.mockResolvedValue([
      {
        installRef: 'anthropics/skills@frontend-design',
        source: 'anthropics/skills',
        skill: 'frontend-design'
      }
    ])
    mocks.installSkillsCliRefToTemp.mockResolvedValue({
      tempDir: installWorkspace,
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
        '  - frontend-design',
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

    const dependency = bundle.skills.find(asset => asset.name === 'frontend-design')
    expect(bundle.skills.map(asset => asset.name).sort()).toEqual(['app-builder', 'frontend-design'])
    expect(dependency?.sourcePath).toContain(
      '/.ai/caches/skill-dependencies/skills-cli/skills/latest/default/anthropics/skills/frontend-design/'
    )
    expect(mocks.findSkillsCli).toHaveBeenCalledWith({
      config: undefined,
      query: 'frontend-design'
    })
    expect(mocks.installSkillsCliRefToTemp).toHaveBeenCalledWith({
      config: undefined,
      installRef: 'anthropics/skills@frontend-design'
    })
  })

  it('merges top-level skillsCli config ahead of legacy skills.cli aliases', async () => {
    const workspace = await createWorkspace()
    const installedSkillDir = join(installWorkspace, '.agents', 'skills', 'frontend-design')
    await mkdir(installedSkillDir, { recursive: true })
    await writeFile(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: frontend-design\ndescription: UI design guidance\n---\nUse internal design system.\n'
    )

    mocks.installSkillsCliSkillToTemp.mockResolvedValue({
      tempDir: installWorkspace,
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
        '  - example-source/default/public@frontend-design',
        '---',
        'Build the app.'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: {
          cli: {
            package: 'legacy-skills'
          }
        },
        skillsCli: {
          package: '@byted/skills',
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

    expect(mocks.installSkillsCliSkillToTemp).toHaveBeenCalledWith({
      config: {
        package: '@byted/skills',
        registry: 'https://registry.example.com'
      },
      skill: 'frontend-design',
      source: 'example-source/default/public'
    })
  })
})
