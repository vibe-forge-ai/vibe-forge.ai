import { basename, dirname, relative } from 'node:path'
import process from 'node:process'

import Router from '@koa/router'

import type { Definition, Entity, Spec } from '@vibe-forge/core/utils/definition-loader'
import { DefinitionLoader } from '@vibe-forge/core/utils/definition-loader'

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
      console.error('[ai] Failed to load specs:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load specs' }
    }
  })

  router.get('/specs/detail', async (ctx) => {
    const targetPath = typeof ctx.query.path === 'string' ? ctx.query.path : undefined
    if (!targetPath) {
      ctx.status = 400
      ctx.body = { error: 'Missing path' }
      return
    }

    try {
      const specs = await loader.loadDefaultSpecs()
      const spec = specs.find(item => {
        const relativePath = toRelativePath(item.path, workspaceRoot)
        return relativePath === targetPath || item.path === targetPath
      })

      if (!spec) {
        ctx.status = 404
        ctx.body = { error: 'Spec not found' }
        return
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
      console.error('[ai] Failed to load spec detail:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load spec detail' }
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
            skills: toTagList(entity.attributes.skills),
            rules: toTagList(entity.attributes.rules)
          }
        })
      }
    } catch (err) {
      console.error('[ai] Failed to load entities:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load entities' }
    }
  })

  router.get('/entities/detail', async (ctx) => {
    const targetPath = typeof ctx.query.path === 'string' ? ctx.query.path : undefined
    if (!targetPath) {
      ctx.status = 400
      ctx.body = { error: 'Missing path' }
      return
    }

    try {
      const entities = await loader.loadDefaultEntities()
      const entity = entities.find(item => {
        const relativePath = toRelativePath(item.path, workspaceRoot)
        return relativePath === targetPath || item.path === targetPath
      })

      if (!entity) {
        ctx.status = 404
        ctx.body = { error: 'Entity not found' }
        return
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
          skills: toTagList(entity.attributes.skills),
          rules: toTagList(entity.attributes.rules),
          body: entity.body ?? ''
        }
      }
    } catch (err) {
      console.error('[ai] Failed to load entity detail:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load entity detail' }
    }
  })

  return router
}
