import Router from '@koa/router'

import { resolveSkillsCliRuntimeConfig } from '@vibe-forge/utils'

import { loadConfigState } from '#~/services/config/index.js'
import { installSkillHubPlugin, searchSkillHub } from '#~/services/skill-hub/index.js'
import { installSkillsCliSkill, searchSkillsCliSource } from '#~/services/skill-hub/skills-cli.js'
import { badRequest, internalServerError } from '#~/utils/http.js'

const normalizeString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const normalizePositiveInteger = (value: unknown) => {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined
}

const resolveSkillsCliConfig = (mergedConfig: Awaited<ReturnType<typeof loadConfigState>>['mergedConfig']) => (
  resolveSkillsCliRuntimeConfig(mergedConfig)
)

export function skillHubRouter(): Router {
  const router = new Router()

  router.get('/search', async (ctx) => {
    try {
      ctx.body = await searchSkillHub({
        limit: normalizePositiveInteger(ctx.query.limit),
        query: typeof ctx.query.q === 'string' ? ctx.query.q : '',
        registry: typeof ctx.query.registry === 'string' ? ctx.query.registry : undefined
      })
    } catch (err) {
      throw internalServerError('Failed to search skill hub', { cause: err, code: 'skill_hub_search_failed' })
    }
  })

  router.get('/skills-cli/search', async (ctx) => {
    const source = normalizeString(ctx.query.source)
    if (source == null) {
      throw badRequest('Missing source', { source: ctx.query.source }, 'missing_source')
    }

    try {
      const { workspaceFolder, mergedConfig } = await loadConfigState()
      ctx.body = await searchSkillsCliSource({
        config: resolveSkillsCliConfig(mergedConfig),
        limit: normalizePositiveInteger(ctx.query.limit),
        registry: normalizeString(ctx.query.registry ?? ctx.query.npmRegistry),
        query: typeof ctx.query.q === 'string' ? ctx.query.q : '',
        source,
        workspaceFolder
      })
    } catch (err) {
      throw internalServerError('Failed to search skills CLI source', {
        cause: err,
        code: 'skill_hub_skills_cli_search_failed',
        details: {
          source,
          message: err instanceof Error ? err.message : String(err)
        }
      })
    }
  })

  router.post('/install', async (ctx) => {
    const body = ctx.request.body as {
      registry?: unknown
      plugin?: unknown
      force?: unknown
      scope?: unknown
    }
    const registry = normalizeString(body.registry)
    const plugin = normalizeString(body.plugin)

    if (registry == null || plugin == null) {
      throw badRequest('Missing registry or plugin', { registry: body.registry, plugin: body.plugin }, 'missing_target')
    }

    try {
      ctx.body = await installSkillHubPlugin({
        registry,
        plugin,
        force: body.force === true,
        scope: normalizeString(body.scope)
      })
    } catch (err) {
      throw internalServerError('Failed to install skill hub plugin', {
        cause: err,
        code: 'skill_hub_install_failed',
        details: {
          registry,
          plugin,
          message: err instanceof Error ? err.message : String(err)
        }
      })
    }
  })

  router.post('/skills-cli/install', async (ctx) => {
    const body = ctx.request.body as {
      source?: unknown
      skill?: unknown
      force?: unknown
      registry?: unknown
      npmRegistry?: unknown
    }
    const source = normalizeString(body.source)
    const skill = normalizeString(body.skill)

    if (source == null || skill == null) {
      throw badRequest('Missing source or skill', { source: body.source, skill: body.skill }, 'missing_target')
    }

    try {
      const { workspaceFolder, mergedConfig } = await loadConfigState()
      ctx.body = await installSkillsCliSkill({
        config: resolveSkillsCliConfig(mergedConfig),
        force: body.force === true,
        registry: normalizeString(body.registry ?? body.npmRegistry),
        skill,
        source,
        workspaceFolder
      })
    } catch (err) {
      throw internalServerError('Failed to install skills CLI skill', {
        cause: err,
        code: 'skill_hub_skills_cli_install_failed',
        details: {
          source,
          skill,
          message: err instanceof Error ? err.message : String(err)
        }
      })
    }
  })

  return router
}
