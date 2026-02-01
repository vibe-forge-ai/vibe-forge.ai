import fs from 'node:fs'

import Router from '@koa/router'

import { loadEnv } from '@vibe-forge/core'

export function configRouter(): Router {
  const router = new Router()
  const env = loadEnv()

  router.get('/', (ctx) => {
    const cliPath = env.__VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_PATH__
    const cliArgs = env.__VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_ARGS__
    const cliExists = (cliPath != null && cliPath !== '') ? fs.existsSync(cliPath) : false
    ctx.body = {
      __VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_PATH__: cliPath,
      __VF_PROJECT_AI_ADAPTER_CLAUDE_CODE_CLI_ARGS__: cliArgs,
      cliExists
    }
  })

  return router
}
