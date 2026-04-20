import fs from 'node:fs'
import path from 'node:path'
import { cwd, env as processEnv } from 'node:process'

import Router from '@koa/router'

import type Koa from 'koa'

import type { loadEnv } from '@vibe-forge/core'

import { logger } from '#~/utils/logger.js'

import { adaptersRouter } from './adapters'
import { aiRouter } from './ai'
import { authRouter } from './auth'
import { automationRouter } from './automation'
import { benchmarkRouter } from './benchmark'
import { channelActionsRouter } from './channel-actions'
import { configRouter } from './config'
import { gitRouter } from './git'
import { interactRouter } from './interact'
import { mdpRouter } from './mdp'
import { sessionsRouter } from './sessions'
import { skillHubRouter } from './skill-hub'
import { uiRouter } from './ui'
import { workspaceRouter } from './workspace'
import { worktreeEnvironmentsRouter } from './worktree-environments'

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

const trimTrailingSlash = (value: string) => {
  if (value === '/') {
    return value
  }
  return value.replace(/\/+$/, '')
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
    __VF_PROJECT_AI_SERVER_BASE_URL__: env.__VF_PROJECT_AI_PUBLIC_BASE_URL__,
    __VF_PROJECT_AI_SERVER_HOST__: env.__VF_PROJECT_AI_SERVER_HOST__,
    __VF_PROJECT_AI_SERVER_PORT__: String(env.__VF_PROJECT_AI_SERVER_PORT__),
    __VF_PROJECT_AI_SERVER_WS_PATH__: env.__VF_PROJECT_AI_SERVER_WS_PATH__,
    __VF_PROJECT_AI_CLIENT_MODE__: env.__VF_PROJECT_AI_CLIENT_MODE__,
    __VF_PROJECT_AI_CLIENT_BASE__: clientBase
  }
  return `<script>window.__VF_PROJECT_AI_RUNTIME_ENV__=${JSON.stringify(runtimeEnv)}</script>`
}

export interface MountRoutesOptions {
  logClientMount?: boolean
}

export const mountRoutes = async (
  app: Koa,
  env: ReturnType<typeof loadEnv>,
  options: MountRoutesOptions = {}
) => {
  // Routes
  const router = new Router()
  const clientBaseRedirects = new Map<string, string>()
  // Register routers
  const routers = [
    { prefix: '/api/sessions/:sessionId/git', router: gitRouter() },
    { prefix: '/api/sessions', router: sessionsRouter() },
    { prefix: '/api/adapters', router: adaptersRouter() },
    { prefix: '/api/interact', router: interactRouter() },
    { prefix: '/api/auth', router: authRouter(env) },
    { prefix: '/api/ai', router: aiRouter() },
    { prefix: '/api/benchmark', router: benchmarkRouter() },
    { prefix: '/api/skill-hub', router: skillHubRouter() },
    { prefix: '/channels/actions', router: channelActionsRouter() },
    { prefix: '/api/automation', router: automationRouter() },
    { prefix: '/api/config', router: configRouter() },
    { prefix: '/api/mdp', router: mdpRouter() },
    { prefix: '/api/worktree-environments', router: worktreeEnvironmentsRouter() },
    { prefix: '/api/workspace', router: workspaceRouter() }
  ]

  const clientMode = env.__VF_PROJECT_AI_CLIENT_MODE__
  const clientBase = normalizeBase(env.__VF_PROJECT_AI_CLIENT_BASE__)
  const mountedClientBase = clientBase === '/' ? '' : clientBase
  const clientDistPath = clientMode === 'dev' || clientMode === 'none'
    ? null
    : resolveClientDistPath(env.__VF_PROJECT_AI_CLIENT_DIST_PATH__)
  const runtimeScript = createRuntimeScript(env, clientBase)
  if (clientDistPath && clientMode !== 'dev') {
    const registerBaseRedirect = (base: string) => {
      const redirectFrom = trimTrailingSlash(base)
      if (redirectFrom === '/') {
        return
      }
      clientBaseRedirects.set(redirectFrom, base)
    }

    registerBaseRedirect(clientBase)

    const createStaticUiRouter = () =>
      uiRouter({
        base: clientBase,
        distPath: clientDistPath,
        runtimeScript,
        basePlaceholder: DEFAULT_BASE_PLACEHOLDER
      })

    routers.push({
      prefix: mountedClientBase,
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
    .use(async (ctx, next) => {
      const redirectTarget = ctx.method === 'GET'
        ? clientBaseRedirects.get(ctx.path)
        : undefined
      if (redirectTarget != null) {
        ctx.status = 308
        ctx.redirect(redirectTarget)
        return
      }
      await next()
    })
    .use(router.routes())
    .use(router.allowedMethods())

  return {
    onListen: (httpHost: string) => {
      if (clientMode !== 'dev' && options.logClientMount !== false) {
        if (clientDistPath) {
          logger.info(`[server]              ${httpHost}${clientBase} from ${clientDistPath}`)
        } else {
          logger.info('[server] client dist not found, static hosting disabled')
        }
      }
    }
  }
}
