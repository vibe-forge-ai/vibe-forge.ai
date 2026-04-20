import http from 'node:http'
import process from 'node:process'

import Koa from 'koa'

import { loadEnv } from '@vibe-forge/core'

import { loadConfigState } from '#~/services/config/index.js'

import { initChannels } from './channels'
import { initMiddlewares } from './middlewares'
import { mountRoutes } from './routes'
import { logger } from './utils/logger'
import { setupWebSocket } from './websocket'

export interface StartServerOptions {
  entryKind?: 'server' | 'web'
}

export interface ServerRuntime {
  app: Koa
  env: ReturnType<typeof loadEnv>
  server: http.Server
  configs: readonly [
    Awaited<ReturnType<typeof loadConfigState>>['projectConfig'],
    Awaited<ReturnType<typeof loadConfigState>>['userConfig']
  ]
}

const normalizeClientBase = (value?: string, fallback = '/ui/') => {
  let base = value?.trim() || fallback
  if (!base.startsWith('/')) {
    base = `/${base}`
  }
  if (!base.endsWith('/')) {
    base += '/'
  }
  return base
}

const normalizeDisplayHost = (host: string) => {
  const normalized = host.trim()
  if (normalized === '' || normalized === '0.0.0.0') {
    return '127.0.0.1'
  }
  if (normalized === '::' || normalized === '[::]') {
    return 'localhost'
  }
  return normalized
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const resolveDisplayBaseUrl = (env: ReturnType<typeof loadEnv>) => {
  const configuredBaseUrl = env.__VF_PROJECT_AI_PUBLIC_BASE_URL__?.trim()
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl)
  }
  return `http://${normalizeDisplayHost(env.__VF_PROJECT_AI_SERVER_HOST__)}:${env.__VF_PROJECT_AI_SERVER_PORT__}`
}

const resolveEntryKind = (options: StartServerOptions): NonNullable<StartServerOptions['entryKind']> => {
  const explicitEntryKind = options.entryKind
  if (explicitEntryKind != null) {
    return explicitEntryKind
  }

  return process.env.__VF_PROJECT_AI_SERVER_ENTRY_KIND__ === 'web'
    ? 'web'
    : 'server'
}

export async function createServerRuntime(): Promise<ServerRuntime> {
  const env = loadEnv()
  const app = new Koa()
  const handler = app.callback()
  const server = http.createServer((req, res) => {
    void handler(req, res)
  })
  const { projectConfig, userConfig } = await loadConfigState()
  const configs = [projectConfig, userConfig] as const

  return { app, env, server, configs }
}

export async function startServer(options: StartServerOptions = {}): Promise<ServerRuntime> {
  const runtime = await createServerRuntime()
  const { app, env, server, configs } = runtime
  const entryKind = resolveEntryKind(options)

  await initMiddlewares(app, env)
  const { onListen: mountRoutesOnListen } = await mountRoutes(app, env, {
    logClientMount: entryKind !== 'web'
  })
  setupWebSocket(server, env)
  await initChannels(configs)

  const {
    __VF_PROJECT_AI_SERVER_HOST__: serverHost,
    __VF_PROJECT_AI_SERVER_PORT__: serverPort,
    __VF_PROJECT_AI_SERVER_WS_PATH__: serverWSPath
  } = env

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(serverPort, serverHost, () => {
      server.off('error', reject)

      const displayBaseUrl = resolveDisplayBaseUrl(env)
      if (entryKind === 'web') {
        logger.info(
          `[web] ready at ${displayBaseUrl}${normalizeClientBase(env.__VF_PROJECT_AI_CLIENT_BASE__, '/')}`
        )
      } else {
        const host = `${serverHost}:${serverPort}`
        logger.info(`[server] listening on http://${host}`)
        logger.info(`[server]              ws://${host}${serverWSPath}`)
      }

      mountRoutesOnListen(displayBaseUrl)
      resolve()
    })
  })

  return runtime
}
