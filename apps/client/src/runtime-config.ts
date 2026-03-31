export type RuntimeEnv = Partial<{
  __VF_PROJECT_AI_SERVER_HOST__: string
  __VF_PROJECT_AI_SERVER_PORT__: string
  __VF_PROJECT_AI_SERVER_WS_PATH__: string
  __VF_PROJECT_AI_CLIENT_BASE__: string
}>

const getGlobalRuntimeEnv = () => {
  const globalScope = globalThis as { __VF_PROJECT_AI_RUNTIME_ENV__?: RuntimeEnv }
  return globalScope.__VF_PROJECT_AI_RUNTIME_ENV__
}

const normalizeBase = (value?: string) => {
  let base = value?.trim() ?? ''
  if (!base) {
    base = '/ui'
  }
  if (!base.startsWith('/')) {
    base = `/${base}`
  }
  if (base.length > 1 && base.endsWith('/')) {
    base = base.slice(0, -1)
  }
  return base
}

const normalizePath = (value?: string) => {
  let next = value?.trim() ?? ''
  if (!next) {
    return '/ws'
  }
  if (!next.startsWith('/')) {
    next = `/${next}`
  }
  return next
}

export const getRuntimeEnv = (): RuntimeEnv => getGlobalRuntimeEnv() ?? {}

export const getClientBase = () =>
  normalizeBase(
    getRuntimeEnv().__VF_PROJECT_AI_CLIENT_BASE__ ?? import.meta.env.__VF_PROJECT_AI_CLIENT_BASE__
  )

export const getServerHostEnv = () =>
  getRuntimeEnv().__VF_PROJECT_AI_SERVER_HOST__ ??
    import.meta.env.__VF_PROJECT_AI_SERVER_HOST__

export const getServerPortEnv = () =>
  getRuntimeEnv().__VF_PROJECT_AI_SERVER_PORT__ ??
    import.meta.env.__VF_PROJECT_AI_SERVER_PORT__

export const getServerWsPath = () =>
  normalizePath(
    getRuntimeEnv().__VF_PROJECT_AI_SERVER_WS_PATH__ ?? import.meta.env.__VF_PROJECT_AI_SERVER_WS_PATH__
  )
