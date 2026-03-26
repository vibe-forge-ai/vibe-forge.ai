import { basename, dirname, relative } from 'node:path'
import process from 'node:process'

import Router from '@koa/router'

import type { Definition, Entity, Rule, Spec } from '@vibe-forge/core/utils/definition-loader'
import { DefinitionLoader } from '@vibe-forge/core/utils/definition-loader'

import { badRequest, internalServerError, isHttpError, notFound } from '#~/utils/http.js'

const getFirstNonEmptyLine = (text: string) =>
  text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)

const toRelativePath = (absolutePath: string, cwd: string) => {
  const rel = relative(cwd, absolutePath)
  return rel.startsWith('..') ? absolutePath : rel
}

const resolveSpecName = (spec: Definition<Spec>) => {
  const name = spec.attributes.name?.trim()
  if (name) return name
  const fileName = basename(spec.path)
  if (fileName.toLowerCase() === 'index.md') {
    return basename(dirname(spec.path))
  }
  return fileName.replace(/\.[^/.]+$/, '')
}

const resolveEntityName = (entity: Definition<Entity>) => {
  const name = entity.attributes.name?.trim()
  if (name) return name
  const fileName = basename(entity.path)
  if (fileName.toLowerCase() === 'index.json') {
    return basename(dirname(entity.path))
  }
  return fileName.replace(/\.[^/.]+$/, '')
}

const resolveRuleName = (rule: Definition<Rule>) => {
  const name = rule.attributes.name?.trim()
  if (name) return name
  const fileName = basename(rule.path)
  return fileName.replace(/\.[^/.]+$/, '')
}

const toTagList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (value && typeof value === 'object') {
    const include = (value as { include?: unknown }).include
    if (Array.isArray(include)) {
      return include.filter((item): item is string => typeof item === 'string')
    }
  }
  return []
}

const toSkillList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (value && typeof value === 'object') {
    const list = (value as { list?: unknown }).list
    if (Array.isArray(list)) {
      return list.filter((item): item is string => typeof item === 'string')
    }
  }
  return []
}

const toRuleList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item == null || typeof item !== 'object') return []

    const desc = typeof (item as { desc?: unknown }).desc === 'string'
      ? (item as { desc: string }).desc
      : undefined

    if ((item as { type?: unknown }).type === 'remote') {
      const tags = toStringList((item as { tags?: unknown }).tags)
      return [desc ?? (tags.length > 0 ? `remote:${tags.join(',')}` : 'remote')]
    }

    const path = typeof (item as { path?: unknown }).path === 'string'
      ? (item as { path: string }).path
      : undefined

    return [desc ?? path].filter((rule): rule is string => Boolean(rule))
  })
}

const toStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value === 'string') return [value]
  return []
}

export function aiRouter(): Router {
  const router = new Router()
  const workspaceRoot = process.env.WORKSPACE_FOLDER || process.cwd()
  const loader = new DefinitionLoader(workspaceRoot)

  router.get('/specs', async (ctx) => {
    try {
      const specs = await loader.loadDefaultSpecs()
      ctx.body = {
        specs: specs.map(spec => {
          const name = resolveSpecName(spec)
          const description = spec.attributes.description ?? getFirstNonEmptyLine(spec.body) ?? name
          const tags = toTagList(spec.attributes.tags)
          return {
            id: toRelativePath(spec.path, workspaceRoot),
            name,
            description,
            params: spec.attributes.params ?? [],
            always: spec.attributes.always ?? true,
            tags,
            skills: toTagList(spec.attributes.skills),
            rules: toTagList(spec.attributes.rules)
          }
        })
      }
    } catch (err) {
      throw internalServerError('Failed to load specs', { cause: err, code: 'ai_specs_load_failed' })
    }
  })

  router.get('/specs/detail', async (ctx) => {
    const targetPath = typeof ctx.query.path === 'string' ? ctx.query.path : undefined
    if (!targetPath) {
      throw badRequest('Missing path', undefined, 'missing_path')
    }

    try {
      const specs = await loader.loadDefaultSpecs()
      const spec = specs.find(item => {
        const relativePath = toRelativePath(item.path, workspaceRoot)
        return relativePath === targetPath || item.path === targetPath
      })

      if (!spec) {
        throw notFound('Spec not found', { path: targetPath }, 'spec_not_found')
      }

      const name = resolveSpecName(spec)
      const description = spec.attributes.description ?? getFirstNonEmptyLine(spec.body) ?? name
      const tags = toTagList(spec.attributes.tags)
      ctx.body = {
        spec: {
          id: toRelativePath(spec.path, workspaceRoot),
          name,
          description,
          params: spec.attributes.params ?? [],
          always: spec.attributes.always ?? true,
          tags,
          skills: toTagList(spec.attributes.skills),
          rules: toTagList(spec.attributes.rules),
          body: spec.body ?? ''
        }
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
        entities: entities.map(entity => {
          const name = resolveEntityName(entity)
          const description = entity.attributes.description ?? getFirstNonEmptyLine(entity.body) ?? name
          const tags = toTagList(entity.attributes.tags)
          return {
            id: toRelativePath(entity.path, workspaceRoot),
            name,
            description,
            always: entity.attributes.always ?? true,
            tags,
            skills: toSkillList(entity.attributes.skills),
            rules: toRuleList(entity.attributes.rules)
          }
        })
      }
    } catch (err) {
      throw internalServerError('Failed to load entities', { cause: err, code: 'ai_entities_load_failed' })
    }
  })

  router.get('/rules', async (ctx) => {
    try {
      const rules = await loader.loadDefaultRules()
      ctx.body = {
        rules: rules.map(rule => {
          const name = resolveRuleName(rule)
          const description = rule.attributes.description ?? getFirstNonEmptyLine(rule.body) ?? name
          const alwaysApply = (rule.attributes as { alwaysApply?: boolean }).alwaysApply
          return {
            id: toRelativePath(rule.path, workspaceRoot),
            name,
            description,
            always: rule.attributes.always ?? alwaysApply ?? true,
            globs: toStringList(
              (rule.attributes as { globs?: unknown; glob?: unknown }).globs
                ?? (rule.attributes as { globs?: unknown; glob?: unknown }).glob
            )
          }
        })
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
      const rule = rules.find(item => {
        const relativePath = toRelativePath(item.path, workspaceRoot)
        return relativePath === targetPath || item.path === targetPath
      })

      if (!rule) {
        throw notFound('Rule not found', { path: targetPath }, 'rule_not_found')
      }

      const name = resolveRuleName(rule)
      const description = rule.attributes.description ?? getFirstNonEmptyLine(rule.body) ?? name
      const alwaysApply = (rule.attributes as { alwaysApply?: boolean }).alwaysApply
      ctx.body = {
        rule: {
          id: toRelativePath(rule.path, workspaceRoot),
          name,
          description,
          always: rule.attributes.always ?? alwaysApply ?? true,
          globs: toStringList(
            (rule.attributes as { globs?: unknown; glob?: unknown }).globs
              ?? (rule.attributes as { globs?: unknown; glob?: unknown }).glob
          ),
          body: rule.body ?? ''
        }
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
      const entity = entities.find(item => {
        const relativePath = toRelativePath(item.path, workspaceRoot)
        return relativePath === targetPath || item.path === targetPath
      })

      if (!entity) {
        throw notFound('Entity not found', { path: targetPath }, 'entity_not_found')
      }

      const name = resolveEntityName(entity)
      const description = entity.attributes.description ?? getFirstNonEmptyLine(entity.body) ?? name
      const tags = toTagList(entity.attributes.tags)
      ctx.body = {
        entity: {
          id: toRelativePath(entity.path, workspaceRoot),
          name,
          description,
          always: entity.attributes.always ?? true,
          tags,
          skills: toSkillList(entity.attributes.skills),
          rules: toRuleList(entity.attributes.rules),
          body: entity.body ?? ''
        }
      }
    } catch (err) {
      if (isHttpError(err)) throw err
      throw internalServerError('Failed to load entity detail', { cause: err, code: 'ai_entity_detail_load_failed' })
    }
  })

  return router
}
