import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { Definition, Entity, Rule, Spec } from '@vibe-forge/types'

import {
  matchesDefinitionPath,
  presentEntity,
  presentRule,
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
})
