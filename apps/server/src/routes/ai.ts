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
          return {
            id: toRelativePath(spec.path, workspaceRoot),
            name,
            description,
            params: spec.attributes.params ?? [],
            always: spec.attributes.always ?? true
          }
        })
      }
    } catch (err) {
      console.error('[ai] Failed to load specs:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load specs' }
    }
  })

  router.get('/entities', async (ctx) => {
    try {
      const entities = await loader.loadDefaultEntities()
      ctx.body = {
        entities: entities.map(entity => {
          const name = resolveEntityName(entity)
          const description = entity.attributes.description ?? getFirstNonEmptyLine(entity.body) ?? name
          return {
            id: toRelativePath(entity.path, workspaceRoot),
            name,
            description,
            always: entity.attributes.always ?? true
          }
        })
      }
    } catch (err) {
      console.error('[ai] Failed to load entities:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load entities' }
    }
  })

  return router
}
