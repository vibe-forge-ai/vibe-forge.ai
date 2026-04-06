export type RuntimeEnv = Partial<{
  __VF_PROJECT_AI_SERVER_HOST__: string
  __VF_PROJECT_AI_SERVER_PORT__: string
  __VF_PROJECT_AI_SERVER_WS_PATH__: string
  __VF_PROJECT_AI_CLIENT_BASE__: string
}>

export const resolveDevDocumentTitle = (
  baseTitle: string,
  input: {
    isDev: boolean
    gitRef?: string
  }
) => {
  const normalizedBaseTitle = (baseTitle.trim() === '' ? 'Vibe Forge Web' : baseTitle.trim())
    .replace(/\s+\[[^\]]+\]$/, '')
  if (!input.isDev) {
    return normalizedBaseTitle
  }

  const gitRef = input.gitRef?.trim()
  if (gitRef == null || gitRef === '') {
    return normalizedBaseTitle
  }

  return `${normalizedBaseTitle} [${gitRef}]`
}

const getGlobalRuntimeEnv = () => {
  const globalScope = globalThis as { __VF_PROJECT_AI_RUNTIME_ENV__?: RuntimeEnv }
  return globalScope.__VF_PROJECT_AI_RUNTIME_ENV__
}

const pickNonEmptyValue = (...values: Array<string | undefined>) => (
  values.find((value) => typeof value === 'string' && value.trim() !== '')
)

const normalizeBase = (value?: string) => {
  let base = value?.trim() ?? '/ui'
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

export const resolveClientBase = (...values: Array<string | undefined>) => (
  normalizeBase(pickNonEmptyValue(...values))
)

export const getClientBase = () => (
  resolveClientBase(
    getRuntimeEnv().__VF_PROJECT_AI_CLIENT_BASE__,
    import.meta.env.__VF_PROJECT_AI_CLIENT_BASE__,
    import.meta.env.BASE_URL,
    '/ui'
  )
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
