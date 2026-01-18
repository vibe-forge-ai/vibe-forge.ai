import Router from '@koa/router'
import fs from 'node:fs'
import { loadEnv } from '#~/env.js'

export function configRouter(): Router {
  const router = new Router()
  const env = loadEnv()

  router.get('/', (ctx) => {
    const cliPath = env.CLAUDE_CODE_CLI_PATH
    const configPath = env.CLAUDE_CODE_CONFIG_PATH
    const cliExists = cliPath ? fs.existsSync(cliPath) : false
    const configExists = configPath ? fs.existsSync(configPath) : false
    ctx.body = {
      CLAUDE_CODE_CLI_PATH: cliPath,
      CLAUDE_CODE_CONFIG_PATH: configPath,
      cliExists,
      configExists,
    }
  })

  return router
}
