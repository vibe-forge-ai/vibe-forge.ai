import fs from 'node:fs'

import Router from '@koa/router'

import { loadEnv } from '@vibe-forge/core'

export function configRouter(): Router {
  const router = new Router()
  const env = loadEnv()

  router.get('/', (ctx) => {
    const cliPath = env.CLAUDE_CODE_CLI_PATH
    const cliArgs = env.CLAUDE_CODE_CLI_ARGS
    const cliExists = (cliPath != null && cliPath !== '') ? fs.existsSync(cliPath) : false
    ctx.body = {
      CLAUDE_CODE_CLI_PATH: cliPath,
      CLAUDE_CODE_CLI_ARGS: cliArgs,
      cliExists
    }
  })

  return router
}
