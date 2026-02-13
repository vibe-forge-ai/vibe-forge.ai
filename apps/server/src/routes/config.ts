import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import Router from '@koa/router'

import type { Config } from '@vibe-forge/core'
import { loadConfig, updateConfigFile } from '@vibe-forge/core'

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => sanitize(item))
  }
  if (value != null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = sanitize(val)
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
  plugins: user?.plugins ?? project?.plugins,
  shortcuts: mergeRecord(project?.shortcuts, user?.shortcuts),
  conversation: mergeRecord(project?.conversation, user?.conversation),
  notifications: mergeRecord(
    project?.notifications as Record<string, unknown> | undefined,
    user?.notifications as Record<string, unknown> | undefined
  ) as Config['notifications']
})

interface AppInfo {
  version?: string
  lastReleaseAt?: string
}

const getAppInfo = async (workspaceFolder: string): Promise<AppInfo> => {
  try {
    const pkgPath = resolve(workspaceFolder, 'package.json')
    const content = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(content) as { version?: string; lastReleaseAt?: string; releaseDate?: string }
    return {
      version: pkg.version,
      lastReleaseAt: pkg.lastReleaseAt ?? pkg.releaseDate
    }
  } catch {
    return {}
  }
}

const buildSections = (config: Config | undefined) => {
  const {
    baseDir,
    defaultAdapter,
    defaultModelService,
    defaultModel,
    interfaceLanguage,
    modelLanguage,
    announcements,
    shortcuts,
    conversation,
    notifications
  } = config ?? {}

  return {
    general: {
      baseDir,
      defaultAdapter,
      defaultModelService,
      defaultModel,
      interfaceLanguage,
      modelLanguage,
      announcements,
      permissions: sanitize(config?.permissions),
      env: sanitize(config?.env),
      notifications: sanitize(notifications)
    },
    conversation: sanitize(conversation),
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
    shortcuts: sanitize(shortcuts)
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
      const urls = {
        repo: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
        docs: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
        contact: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
        issues: 'https://github.com/vibe-forge-ai/vibe-forge.ai/issues',
        releases: 'https://github.com/vibe-forge-ai/vibe-forge.ai/releases'
      }
      const appInfo = await getAppInfo(workspaceFolder)
      const [projectConfig, userConfig] = await loadConfig({ jsonVariables })
      const mergedConfig = mergeConfig(projectConfig, userConfig)
      ctx.body = {
        sources: {
          project: buildSections(projectConfig),
          user: buildSections(userConfig),
          merged: buildSections(mergedConfig)
        },
        meta: {
          workspaceFolder,
          configPresent: {
            project: projectConfig != null,
            user: userConfig != null
          },
          experiments: {},
          about: {
            version: appInfo.version,
            lastReleaseAt: appInfo.lastReleaseAt,
            urls
          }
        }
      }
    } catch (err) {
      console.error('[config] Failed to load config:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load config' }
    }
  })

  router.patch('/', async (ctx) => {
    const { source, section, value } = ctx.request.body as {
      source?: 'project' | 'user'
      section?: string
      value?: unknown
    }

    if (source !== 'project' && source !== 'user') {
      ctx.status = 400
      ctx.body = { error: 'Invalid source' }
      return
    }

    if (section == null || typeof section !== 'string' || section.trim() === '') {
      ctx.status = 400
      ctx.body = { error: 'Invalid section' }
      return
    }

    try {
      const workspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
      await updateConfigFile({ workspaceFolder, source, section, value })
      ctx.body = { ok: true }
    } catch (err) {
      console.error('[config] Failed to update config:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to update config' }
    }
  })

  return router
}
