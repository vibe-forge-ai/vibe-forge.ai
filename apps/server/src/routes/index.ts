import fs from 'node:fs'
import path from 'node:path'
import { cwd, env as processEnv } from 'node:process'

import Router from '@koa/router'

import type Koa from 'koa'

import type { loadEnv } from '@vibe-forge/core'

import { logger } from '#~/utils/logger.js'

import { aiRouter } from './ai'
import { automationRouter } from './automation'
import { benchmarkRouter } from './benchmark'
import { channelActionsRouter } from './channel-actions'
import { configRouter } from './config'
import { interactRouter } from './interact'
import { sessionsRouter } from './sessions'
import { uiRouter } from './ui'
import { workspaceRouter } from './workspace'

const DEFAULT_CLIENT_BASE = '/ui/'
const DEFAULT_BASE_PLACEHOLDER = '/__VF_PROJECT_AI_CLIENT_BASE__/'

const normalizeBase = (value?: string) => {
  let base = value?.trim() || DEFAULT_CLIENT_BASE
  if (!base.startsWith('/')) {
    base = `/${base}`
  }
  if (!base.endsWith('/')) {
    base += '/'
  }
  return base
}

const resolveClientDistPath = (distPath: string | undefined) => {
  const workspaceFolder = processEnv.__VF_PROJECT_WORKSPACE_FOLDER__ ?? cwd()
  const packageDir = processEnv.__VF_PROJECT_PACKAGE_DIR__ ?? cwd()
  const candidates: string[] = []

  if (distPath?.trim()) {
    const rawPath = distPath.trim()
    const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(workspaceFolder, rawPath)
    candidates.push(resolved)
  }

  candidates.push(
    path.resolve(workspaceFolder, 'apps/client/dist'),
    path.resolve(workspaceFolder, 'client/dist'),
    path.resolve(packageDir, '../client/dist'),
    path.resolve(packageDir, '../../client/dist'),
    path.resolve(workspaceFolder, 'node_modules/@vibe-forge/client/dist'),
    path.resolve(packageDir, '../../node_modules/@vibe-forge/client/dist')
  )

  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue
    seen.add(candidate)
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate
    }
  }
  return null
}

const createRuntimeScript = (env: ReturnType<typeof loadEnv>, clientBase: string) => {
  const runtimeEnv = {
    __VF_PROJECT_AI_SERVER_HOST__: env.__VF_PROJECT_AI_SERVER_HOST__,
    __VF_PROJECT_AI_SERVER_PORT__: String(env.__VF_PROJECT_AI_SERVER_PORT__),
    __VF_PROJECT_AI_SERVER_WS_PATH__: env.__VF_PROJECT_AI_SERVER_WS_PATH__,
    __VF_PROJECT_AI_CLIENT_BASE__: clientBase
  }
  return `<script>window.__VF_PROJECT_AI_RUNTIME_ENV__=${JSON.stringify(runtimeEnv)}</script>`
}

export const mountRoutes = async (app: Koa, env: ReturnType<typeof loadEnv>) => {
  // Routes
  const router = new Router()
  // Register routers
  const routers = [
    { prefix: '/api/sessions', router: sessionsRouter() },
    { prefix: '/api/interact', router: interactRouter() },
    { prefix: '/api/ai', router: aiRouter() },
    { prefix: '/api/benchmark', router: benchmarkRouter() },
    { prefix: '/channels/actions', router: channelActionsRouter() },
    { prefix: '/api/automation', router: automationRouter() },
    { prefix: '/api/config', router: configRouter() },
    { prefix: '/api/workspace', router: workspaceRouter() }
  ]

  const clientMode = env.__VF_PROJECT_AI_CLIENT_MODE__
  const clientBase = normalizeBase(env.__VF_PROJECT_AI_CLIENT_BASE__)
  const clientDistPath = clientMode === 'dev'
    ? null
    : resolveClientDistPath(env.__VF_PROJECT_AI_CLIENT_DIST_PATH__)
  const runtimeScript = createRuntimeScript(env, clientBase)
  if (clientDistPath && clientMode !== 'dev') {
    const createStaticUiRouter = () =>
      uiRouter({
        base: clientBase,
        distPath: clientDistPath,
        runtimeScript,
        basePlaceholder: DEFAULT_BASE_PLACEHOLDER
      })

    routers.push({
      prefix: clientBase,
      router: createStaticUiRouter()
    })

    if (clientBase !== DEFAULT_BASE_PLACEHOLDER) {
      routers.push({
        prefix: DEFAULT_BASE_PLACEHOLDER,
        router: createStaticUiRouter()
      })
    }
  }

  for (const { prefix, router: childRouter } of routers) {
    router
      .use(prefix, childRouter.routes(), childRouter.allowedMethods())
  }

  app
    .use(router.routes())
    .use(router.allowedMethods())

  return {
    onListen: (httpHost: string) => {
      if (clientMode !== 'dev') {
        if (clientDistPath) {
          logger.info(`[server]              ${httpHost}${clientBase} from ${clientDistPath}`)
        } else {
          logger.info('[server] client dist not found, static hosting disabled')
        }
      }
    }
  }
}
