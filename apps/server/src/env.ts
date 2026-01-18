import 'dotenv/config'
export type ServerEnv = {
  SERVER_PORT: number
  WS_PATH: string
  DATA_DIR: string
  LOG_DIR: string
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
  CLAUDE_CODE_CLI_PATH?: string
  CLAUDE_CODE_CLI_ARGS?: string
  ALLOW_CORS: boolean
}

export function loadEnv(): ServerEnv {
  const env = process.env
  return {
    SERVER_PORT: Number(env.SERVER_PORT || 8787),
    WS_PATH: '/ws',
    DATA_DIR: env.DATA_DIR || '.data',
    LOG_DIR: env.LOG_DIR || '.logs',
    LOG_LEVEL: (env.LOG_LEVEL as ServerEnv['LOG_LEVEL']) || 'info',
    CLAUDE_CODE_CLI_PATH: env.CLAUDE_CODE_CLI_PATH,
    CLAUDE_CODE_CLI_ARGS: env.CLAUDE_CODE_CLI_ARGS,
    ALLOW_CORS: env.ALLOW_CORS ? env.ALLOW_CORS === 'true' : true
  }
}
