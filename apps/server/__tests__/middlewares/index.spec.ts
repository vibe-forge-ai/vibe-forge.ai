import http from 'node:http'

import Koa from 'koa'
import { afterEach, describe, expect, it } from 'vitest'

import type { ServerEnv } from '@vibe-forge/core'

import { initMiddlewares } from '#~/middlewares/index.js'

const createEnv = (allowCors: boolean): ServerEnv => ({
  __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
  __VF_PROJECT_AI_SERVER_PORT__: 0,
  __VF_PROJECT_AI_SERVER_WS_PATH__: '/ws',
  __VF_PROJECT_AI_SERVER_DATA_DIR__: '.data',
  __VF_PROJECT_AI_SERVER_LOG_DIR__: '.logs',
  __VF_PROJECT_AI_SERVER_LOG_LEVEL__: 'info',
  __VF_PROJECT_AI_SERVER_DEBUG__: false,
  __VF_PROJECT_AI_SERVER_ALLOW_CORS__: allowCors
})

describe('initMiddlewares', () => {
  let server: http.Server | undefined

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (server == null) {
        resolve()
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
    server = undefined
  })

  it('only enables CORS when the env flag is true', async () => {
    const createResponse = async (allowCors: boolean) => {
      const app = new Koa()
      await initMiddlewares(app, createEnv(allowCors))
      app.use(async (ctx) => {
        ctx.body = { ok: true }
      })

      server = http.createServer(app.callback())
      await new Promise<void>((resolve) => {
        server!.listen(0, '127.0.0.1', () => resolve())
      })

      const address = server.address()
      if (address == null || typeof address === 'string') {
        throw new Error('Failed to start middleware test server')
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/api/test`, {
        headers: {
          Origin: 'https://client.example'
        }
      })

      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
      server = undefined

      return response
    }

    const disabledResponse = await createResponse(false)
    expect(disabledResponse.headers.get('access-control-allow-origin')).toBeNull()

    const enabledResponse = await createResponse(true)
    expect(enabledResponse.headers.get('access-control-allow-origin')).toBe('https://client.example')
  })
})
