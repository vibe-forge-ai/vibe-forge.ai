const path = require('node:path')

const packageJson = require('./package.json')

const DEFAULT_CLIENT_BASE = '/ui/'
const DEFAULT_BASE_PLACEHOLDER = '/__VF_PROJECT_AI_CLIENT_BASE__/'
const DEFAULT_SERVER_WS_PATH = '/ws'

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const normalizeBase = (value = DEFAULT_CLIENT_BASE) => {
  let base = typeof value === 'string' ? value.trim() : DEFAULT_CLIENT_BASE
  if (!base) {
    base = DEFAULT_CLIENT_BASE
  }
  if (!base.startsWith('/')) {
    base = `/${base}`
  }
  if (!base.endsWith('/')) {
    base += '/'
  }
  return base
}

const trimTrailingSlash = (value) => {
  if (value === '/') {
    return value
  }
  return value.replace(/\/+$/, '')
}

const normalizePath = (value, fallback) => {
  let next = typeof value === 'string' ? value.trim() : ''
  if (!next) {
    return fallback
  }
  if (!next.startsWith('/')) {
    next = `/${next}`
  }
  return next
}

const replaceBase = (content, base, placeholder) => {
  if (!placeholder || placeholder === base) {
    return content
  }
  return content.split(placeholder).join(base)
}

const createRuntimeScript = (base, env) => {
  const runtimeEnv = {
    __VF_PROJECT_AI_SERVER_BASE_URL__: env.__VF_PROJECT_AI_SERVER_BASE_URL__,
    __VF_PROJECT_AI_SERVER_HOST__: env.__VF_PROJECT_AI_SERVER_HOST__,
    __VF_PROJECT_AI_SERVER_PORT__: env.__VF_PROJECT_AI_SERVER_PORT__,
    __VF_PROJECT_AI_SERVER_WS_PATH__: normalizePath(
      env.__VF_PROJECT_AI_SERVER_WS_PATH__,
      DEFAULT_SERVER_WS_PATH
    ),
    __VF_PROJECT_AI_CLIENT_MODE__: env.__VF_PROJECT_AI_CLIENT_MODE__ ?? 'static',
    __VF_PROJECT_AI_CLIENT_BASE__: trimTrailingSlash(base),
    __VF_PROJECT_AI_CLIENT_VERSION__: env.__VF_PROJECT_AI_CLIENT_VERSION__ ?? packageJson.version,
    __VF_PROJECT_AI_CLIENT_COMMIT_HASH__: env.__VF_PROJECT_AI_CLIENT_COMMIT_HASH__ ?? ''
  }
  return `<script>window.__VF_PROJECT_AI_RUNTIME_ENV__=${JSON.stringify(runtimeEnv)}</script>`
}

const getContentType = (filePath) => {
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()]
  return contentType ?? 'application/octet-stream'
}

const resolveStaticFile = (distPath, relativePath) => {
  const normalizedRelativePath = relativePath.replace(/^\/+/, '')
  if (!normalizedRelativePath || normalizedRelativePath.includes('\0')) {
    return null
  }

  const absolutePath = path.resolve(distPath, normalizedRelativePath)
  const relativeFromRoot = path.relative(distPath, absolutePath)
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    return null
  }

  return {
    absolutePath,
    relativePath: normalizedRelativePath
  }
}

const formatOriginHost = (host) => {
  if (host === '0.0.0.0') {
    return '127.0.0.1'
  }
  if (host === '::') {
    return '[::1]'
  }
  return host.includes(':') ? `[${host}]` : host
}

module.exports = {
  DEFAULT_BASE_PLACEHOLDER,
  DEFAULT_CLIENT_BASE,
  createRuntimeScript,
  formatOriginHost,
  getContentType,
  normalizeBase,
  replaceBase,
  resolveStaticFile,
  trimTrailingSlash
}
