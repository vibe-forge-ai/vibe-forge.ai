import process from 'node:process'

import Router from '@koa/router'

import { DefinitionLoader } from '@vibe-forge/definition-loader'
import type { Definition, Entity, Rule, Skill, Spec } from '@vibe-forge/types'

import { importSkillArchive } from '#~/services/ai/skill-archive-import.js'
import { createProjectSkill } from '#~/services/ai/skill-create.js'
import { badRequest, internalServerError, isHttpError, notFound } from '#~/utils/http.js'
import {
  matchesDefinitionPath,
  presentEntity,
  presentEntityDetail,
  presentRule,
  presentRuleDetail,
  presentSkill,
  presentSkillDetail,
  presentSpec,
  presentSpecDetail
} from './ai-presenters'

export function aiRouter(): Router {
  const router = new Router()
  const workspaceRoot = process.env.WORKSPACE_FOLDER || process.cwd()
  const loader = new DefinitionLoader(workspaceRoot)

  router.get('/specs', async (ctx) => {
    try {
      const specs = await loader.loadDefaultSpecs()
      ctx.body = {
        specs: specs.map((spec: Definition<Spec>) => presentSpec(spec, workspaceRoot))
      }
    } catch (err) {
      throw internalServerError('Failed to load specs', { cause: err, code: 'ai_specs_load_failed' })
    }
  })

  router.get('/skills', async (ctx) => {
    try {
      const skills = await loader.loadDefaultSkills()
      ctx.body = {
        skills: skills.map((skill: Definition<Skill>) => presentSkill(skill, workspaceRoot))
      }
    } catch (err) {
      throw internalServerError('Failed to load skills', { cause: err, code: 'ai_skills_load_failed' })
    }
  })

  router.post('/skills', async (ctx) => {
    try {
      ctx.status = 201
      ctx.body = {
        skill: await createProjectSkill(workspaceRoot, (ctx.request.body ?? {}) as Record<string, unknown>)
      }
    } catch (err) {
      if (isHttpError(err)) throw err
      throw internalServerError('Failed to create skill', { cause: err, code: 'ai_skill_create_failed' })
    }
  })

  router.post('/skills/import', async (ctx) => {
    const archiveName = ctx.get('x-file-name')
    ctx.body = await importSkillArchive(workspaceRoot, ctx.req, archiveName)
  })

  router.get('/skills/detail', async (ctx) => {
    const targetPath = typeof ctx.query.path === 'string' ? ctx.query.path : undefined
    if (!targetPath) {
      throw badRequest('Missing path', undefined, 'missing_path')
    }

    try {
      const skills = await loader.loadDefaultSkills()
      const skill = skills.find((item: Definition<Skill>) => matchesDefinitionPath(item, targetPath, workspaceRoot))

      if (!skill) {
        throw notFound('Skill not found', { path: targetPath }, 'skill_not_found')
      }

      ctx.body = {
        skill: presentSkillDetail(skill, workspaceRoot)
      }
    } catch (err) {
      if (isHttpError(err)) throw err
      throw internalServerError('Failed to load skill detail', { cause: err, code: 'ai_skill_detail_load_failed' })
    }
  })

  router.get('/specs/detail', async (ctx) => {
    const targetPath = typeof ctx.query.path === 'string' ? ctx.query.path : undefined
    if (!targetPath) {
      throw badRequest('Missing path', undefined, 'missing_path')
    }

    try {
      const specs = await loader.loadDefaultSpecs()
      const spec = specs.find((item: Definition<Spec>) => matchesDefinitionPath(item, targetPath, workspaceRoot))

      if (!spec) {
        throw notFound('Spec not found', { path: targetPath }, 'spec_not_found')
      }

      ctx.body = {
        spec: presentSpecDetail(spec, workspaceRoot)
      }
    } catch (err) {
      if (isHttpError(err)) throw err
      throw internalServerError('Failed to load spec detail', { cause: err, code: 'ai_spec_detail_load_failed' })
    }
  })

  router.get('/entities', async (ctx) => {
    try {
      const entities = await loader.loadDefaultEntities()
      ctx.body = {
        entities: entities.map((entity: Definition<Entity>) => presentEntity(entity, workspaceRoot))
      }
    } catch (err) {
      throw internalServerError('Failed to load entities', { cause: err, code: 'ai_entities_load_failed' })
    }
  })

  router.get('/rules', async (ctx) => {
    try {
      const rules = await loader.loadDefaultRules()
      ctx.body = {
        rules: rules.map((rule: Definition<Rule>) => presentRule(rule, workspaceRoot))
      }
    } catch (err) {
      throw internalServerError('Failed to load rules', { cause: err, code: 'ai_rules_load_failed' })
    }
  })

  router.get('/rules/detail', async (ctx) => {
    const targetPath = typeof ctx.query.path === 'string' ? ctx.query.path : undefined
    if (!targetPath) {
      throw badRequest('Missing path', undefined, 'missing_path')
    }

    try {
      const rules = await loader.loadDefaultRules()
      const rule = rules.find((item: Definition<Rule>) => matchesDefinitionPath(item, targetPath, workspaceRoot))

      if (!rule) {
        throw notFound('Rule not found', { path: targetPath }, 'rule_not_found')
      }

      ctx.body = {
        rule: presentRuleDetail(rule, workspaceRoot)
      }
    } catch (err) {
      if (isHttpError(err)) throw err
      throw internalServerError('Failed to load rule detail', { cause: err, code: 'ai_rule_detail_load_failed' })
    }
  })

  router.get('/entities/detail', async (ctx) => {
    const targetPath = typeof ctx.query.path === 'string' ? ctx.query.path : undefined
    if (!targetPath) {
      throw badRequest('Missing path', undefined, 'missing_path')
    }

    try {
      const entities = await loader.loadDefaultEntities()
      const entity = entities.find((item: Definition<Entity>) => matchesDefinitionPath(item, targetPath, workspaceRoot))

      if (!entity) {
        throw notFound('Entity not found', { path: targetPath }, 'entity_not_found')
      }

      ctx.body = {
        entity: presentEntityDetail(entity, workspaceRoot)
      }
    } catch (err) {
      if (isHttpError(err)) throw err
      throw internalServerError('Failed to load entity detail', { cause: err, code: 'ai_entity_detail_load_failed' })
    }
  })

  return router
}
