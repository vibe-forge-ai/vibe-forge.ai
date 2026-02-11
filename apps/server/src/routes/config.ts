import process from 'node:process'

import Router from '@koa/router'

import type { Config } from '@vibe-forge/core'
import { loadConfig } from '@vibe-forge/core'

const shouldMaskKey = (key: string) => /key|token|secret|password/i.test(key)

const maskValue = (value: string) => (value === '' ? '' : '******')

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => sanitize(item))
  }
  if (value != null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      const next = sanitize(val)
      acc[key] = (shouldMaskKey(key) && typeof next === 'string') ? maskValue(next) : next
      return acc
    }, {})
  }
  return value
}

const mergeRecord = <T>(left?: Record<string, T>, right?: Record<string, T>) => {
  if (left == null && right == null) return undefined
  return {
    ...(left ?? {}),
    ...(right ?? {})
  }
}

const mergeConfig = (project?: Config, user?: Config): Config => ({
  ...project,
  ...user,
  adapters: mergeRecord(
    project?.adapters as Record<string, unknown> | undefined,
    user?.adapters as Record<string, unknown> | undefined
  ) as Config['adapters'],
  modelServices: mergeRecord(project?.modelServices, user?.modelServices),
  mcpServers: mergeRecord(project?.mcpServers, user?.mcpServers),
  enabledPlugins: mergeRecord(project?.enabledPlugins, user?.enabledPlugins),
  extraKnownMarketplaces: mergeRecord(project?.extraKnownMarketplaces, user?.extraKnownMarketplaces),
  plugins: user?.plugins ?? project?.plugins
})

const buildSections = (config: Config | undefined, workspaceFolder: string, present: boolean) => {
  const {
    baseDir,
    defaultAdapter,
    defaultModelService,
    defaultModel,
    announcements
  } = config ?? {}

  return {
    general: {
      baseDir,
      defaultAdapter,
      defaultModelService,
      defaultModel,
      announcements,
      permissions: sanitize(config?.permissions),
      env: sanitize(config?.env)
    },
    conversation: {},
    modelServices: sanitize(config?.modelServices),
    adapters: sanitize(config?.adapters),
    plugins: sanitize({
      plugins: config?.plugins,
      enabledPlugins: config?.enabledPlugins,
      extraKnownMarketplaces: config?.extraKnownMarketplaces
    }),
    mcp: sanitize({
      mcpServers: config?.mcpServers,
      defaultIncludeMcpServers: config?.defaultIncludeMcpServers,
      defaultExcludeMcpServers: config?.defaultExcludeMcpServers,
      noDefaultVibeForgeMcpServer: config?.noDefaultVibeForgeMcpServer
    }),
    about: {
      workspaceFolder,
      present
    }
  }
}

export function configRouter(): Router {
  const router = new Router()

  router.get('/', async (ctx) => {
    try {
      const workspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
      const jsonVariables: Record<string, string | null | undefined> = {
        ...process.env,
        WORKSPACE_FOLDER: workspaceFolder,
        __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder
      }
      const [projectConfig, userConfig] = await loadConfig({ jsonVariables })
      const mergedConfig = mergeConfig(projectConfig, userConfig)
      ctx.body = {
        sources: {
          project: buildSections(projectConfig, workspaceFolder, projectConfig != null),
          user: buildSections(userConfig, workspaceFolder, userConfig != null),
          merged: buildSections(mergedConfig, workspaceFolder, projectConfig != null || userConfig != null)
        },
        meta: {
          workspaceFolder,
          configPresent: {
            project: projectConfig != null,
            user: userConfig != null
          }
        }
      }
    } catch (err) {
      console.error('[config] Failed to load config:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load config' }
    }
  })

  return router
}
