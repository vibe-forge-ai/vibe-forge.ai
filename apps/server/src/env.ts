import 'dotenv/config'
export type ServerEnv = {
  SERVER_PORT: number
  WS_PATH: string
  PROJECTS_ROOT: string
  DATA_DIR: string
  LOG_DIR: string
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
  CLAUDE_CODE_CLI_PATH?: string
  CLAUDE_CODE_CONFIG_PATH?: string
  ALLOW_CORS: boolean
}

export function loadEnv(): ServerEnv {
  const env = process.env
  return {
    SERVER_PORT: Number(env.SERVER_PORT || 8787),
    WS_PATH: env.WS_PATH || '/ws',
    PROJECTS_ROOT: env.PROJECTS_ROOT || 'projects',
    DATA_DIR: env.DATA_DIR || '.data',
    LOG_DIR: env.LOG_DIR || '.logs',
    LOG_LEVEL: (env.LOG_LEVEL as ServerEnv['LOG_LEVEL']) || 'info',
    CLAUDE_CODE_CLI_PATH: env.CLAUDE_CODE_CLI_PATH,
    CLAUDE_CODE_CONFIG_PATH: env.CLAUDE_CODE_CONFIG_PATH,
    ALLOW_CORS: env.ALLOW_CORS ? env.ALLOW_CORS === 'true' : true
  }
}
