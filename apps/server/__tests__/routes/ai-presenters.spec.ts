import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { Definition, Entity, Rule, Skill, Spec } from '@vibe-forge/types'

import {
  matchesDefinitionPath,
  presentEntity,
  presentRule,
  presentSkill,
  presentSkillDetail,
  presentSpec,
  presentSpecDetail
} from '#~/routes/ai-presenters.js'

describe('ai presenters', () => {
  const cwd = '/workspace/project'

  it('presents specs with shared naming and description rules', () => {
    const spec: Definition<Spec> = {
      path: join(cwd, '.ai/specs/release/index.md'),
      body: '发布流程\n执行发布',
      attributes: {
        skills: ['research'],
        rules: ['.ai/rules/release.md']
      }
    }

    expect(presentSpec(spec, cwd)).toEqual({
      id: '.ai/specs/release/index.md',
      name: 'release',
      description: '发布流程',
      params: [],
      always: true,
      tags: [],
      skills: ['research'],
      rules: ['.ai/rules/release.md']
    })
    expect(presentSpecDetail(spec, cwd).body).toBe('发布流程\n执行发布')
  })

  it('presents entities with mixed skill and rule reference forms', () => {
    const entity: Definition<Entity> = {
      path: join(cwd, '.ai/entities/reviewer/README.md'),
      body: '负责代码评审',
      attributes: {
        skills: {
          type: 'include',
          list: ['review']
        },
        rules: [
          {
            path: './rules/checklist.md',
            desc: '评审检查清单'
          },
          {
            type: 'remote',
            tags: ['security']
          }
        ]
      }
    }

    expect(presentEntity(entity, cwd)).toEqual({
      id: '.ai/entities/reviewer/README.md',
      name: 'reviewer',
      description: '负责代码评审',
      always: true,
      tags: [],
      skills: ['review'],
      rules: ['评审检查清单', 'remote:security']
    })
  })

  it('presents rules with alwaysApply compatibility and path matching', () => {
    const rule: Definition<Rule> = {
      path: join(cwd, '.ai/rules/base.md'),
      body: '始终检查边界',
      attributes: {
        alwaysApply: true,
        globs: 'src/**/*.ts'
      }
    }

    expect(presentRule(rule, cwd)).toEqual({
      id: '.ai/rules/base.md',
      name: 'base',
      description: '始终检查边界',
      always: true,
      globs: ['src/**/*.ts']
    })
    expect(matchesDefinitionPath(rule, '.ai/rules/base.md', cwd)).toBe(true)
    expect(matchesDefinitionPath(rule, rule.path, cwd)).toBe(true)
    expect(matchesDefinitionPath(rule, '.ai/rules/missing.md', cwd)).toBe(false)
  })

  it('presents skill sources for project, plugin, and home entries', () => {
    const projectSkill: Definition<Skill> = {
      path: join(cwd, '.ai/skills/research/SKILL.md'),
      body: '阅读 README.md',
      attributes: {}
    }
    const pluginSkill: Definition<Skill> = {
      path: join(cwd, 'node_modules/@vibe-forge/plugin-demo/skills/review/SKILL.md'),
      body: '检查风险',
      attributes: {},
      resolvedInstancePath: 'plugins.demo',
      resolvedSource: 'plugin'
    }
    const homeSkill: Definition<Skill> = {
      path: '/Users/demo/.agents/skills/home-bridge/SKILL.md',
      body: '整理本地偏好',
      attributes: {},
      resolvedSource: 'home'
    }

    expect(presentSkill(projectSkill, cwd)).toEqual({
      id: '.ai/skills/research/SKILL.md',
      name: 'research',
      description: '阅读 README.md',
      always: false,
      instancePath: undefined,
      source: 'project'
    })
    expect(presentSkill(pluginSkill, cwd)).toEqual({
      id: 'node_modules/@vibe-forge/plugin-demo/skills/review/SKILL.md',
      name: 'review',
      description: '检查风险',
      always: false,
      instancePath: 'plugins.demo',
      source: 'plugin'
    })
    expect(presentSkillDetail(homeSkill, cwd)).toEqual({
      id: '/Users/demo/.agents/skills/home-bridge/SKILL.md',
      name: 'home-bridge',
      description: '整理本地偏好',
      always: false,
      instancePath: undefined,
      source: 'home',
      body: '整理本地偏好'
    })
  })
})
