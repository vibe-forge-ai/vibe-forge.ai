import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import Router from '@koa/router'

import { updateConfigFile } from '@vibe-forge/config'
import type { AdapterBuiltinModel, Config } from '@vibe-forge/types'

import { getWorkspaceFolder, loadConfigState } from '#~/services/config/index.js'
import { badRequest, internalServerError } from '#~/utils/http.js'

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
    effort,
    defaultAdapter,
    defaultModelService,
    defaultModel,
    recommendedModels,
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
      effort,
      defaultAdapter,
      defaultModelService,
      defaultModel,
      recommendedModels: sanitize(recommendedModels),
      interfaceLanguage,
      modelLanguage,
      announcements,
      permissions: sanitize(config?.permissions),
      env: sanitize(config?.env),
      notifications: sanitize(notifications)
    },
    conversation: sanitize(conversation),
    models: sanitize(config?.models),
    modelServices: sanitize(config?.modelServices),
    channels: sanitize(config?.channels),
    adapters: sanitize(config?.adapters),
    adapterBuiltinModels: {} as Record<string, AdapterBuiltinModel[]>,
    plugins: sanitize({
      plugins: config?.plugins
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

const loadAdapterBuiltinModels = (
  adapters: Config['adapters']
): Record<string, AdapterBuiltinModel[]> => {
  const result: Record<string, AdapterBuiltinModel[]> = {}
  if (!adapters) return result
  for (const adapterKey of Object.keys(adapters)) {
    try {
      const packageName = adapterKey.startsWith('@') ? adapterKey : `@vibe-forge/adapter-${adapterKey}`
      // eslint-disable-next-line ts/no-require-imports
      const mod = require(`${packageName}/models`)
      if (Array.isArray(mod?.builtinModels)) {
        result[adapterKey] = mod.builtinModels
      }
    } catch {
      // Adapter does not export builtin models — skip
    }
  }
  return result
}

export function configRouter(): Router {
  const router = new Router()

  router.get('/', async (ctx) => {
    try {
      const { workspaceFolder, projectConfig, userConfig, mergedConfig } = await loadConfigState()
      const urls = {
        repo: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
        docs: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
        contact: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
        issues: 'https://github.com/vibe-forge-ai/vibe-forge.ai/issues',
        releases: 'https://github.com/vibe-forge-ai/vibe-forge.ai/releases'
      }
      const appInfo = await getAppInfo(workspaceFolder)
      const mergedSections = buildSections(mergedConfig)
      mergedSections.adapterBuiltinModels = loadAdapterBuiltinModels(mergedConfig.adapters)
      ctx.body = {
        sources: {
          project: buildSections(projectConfig),
          user: buildSections(userConfig),
          merged: mergedSections
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
      throw internalServerError('Failed to load config', { cause: err, code: 'config_load_failed' })
    }
  })

  router.patch('/', async (ctx) => {
    const { source, section, value } = ctx.request.body as {
      source?: 'project' | 'user'
      section?: string
      value?: unknown
    }

    if (source !== 'project' && source !== 'user') {
      throw badRequest('Invalid source', { source }, 'invalid_source')
    }

    if (section == null || typeof section !== 'string' || section.trim() === '') {
      throw badRequest('Invalid section', { section }, 'invalid_section')
    }

    try {
      const workspaceFolder = getWorkspaceFolder()
      await updateConfigFile({ workspaceFolder, source, section, value })
      ctx.body = { ok: true }
    } catch (err) {
      throw internalServerError('Failed to update config', { cause: err, code: 'config_update_failed' })
    }
  })

  return router
}
