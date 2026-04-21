import process from 'node:process'

export const BOOTSTRAP_DEBUG_ENV_NAME = 'VF_BOOTSTRAP_DEBUG'

const isTruthyDebugValue = (value: string | undefined) => {
  if (value == null) {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export const isBootstrapDebugEnabled = (
  env: NodeJS.ProcessEnv = process.env
) => isTruthyDebugValue(env[BOOTSTRAP_DEBUG_ENV_NAME])

export const logBootstrapDebug = (
  message: string,
  env: NodeJS.ProcessEnv = process.env
) => {
  if (!isBootstrapDebugEnabled(env)) {
    return
  }

  console.error(message)
}
