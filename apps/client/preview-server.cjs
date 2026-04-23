const { createReadStream } = require('node:fs')
const { readFile, stat } = require('node:fs/promises')
const { createServer } = require('node:http')
const path = require('node:path')

const {
  DEFAULT_BASE_PLACEHOLDER,
  DEFAULT_CLIENT_BASE,
  createRuntimeScript,
  formatOriginHost,
  getContentType,
  normalizeBase,
  replaceBase,
  resolveStaticFile,
  trimTrailingSlash
} = require('./preview-runtime.cjs')

const sendText = (req, res, statusCode, body, contentType) => {
  res.writeHead(statusCode, { 'Content-Type': contentType })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(body)
}

const sendFile = async (req, res, filePath, extraHeaders = {}) => {
  const fileStat = await stat(filePath).catch(() => null)
  if (fileStat == null || !fileStat.isFile()) {
    return false
  }

  res.writeHead(200, {
    'Content-Length': fileStat.size,
    'Content-Type': getContentType(filePath),
    ...extraHeaders
  })

  if (req.method === 'HEAD') {
    res.end()
    return true
  }

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('end', resolve)
    stream.pipe(res)
  })
  return true
}

const createPreviewRequestHandler = ({
  base,
  basePlaceholder = DEFAULT_BASE_PLACEHOLDER,
  distPath,
  runtimeEnv = {}
}) => {
  const normalizedBase = normalizeBase(base)
  const normalizedPlaceholderBase = normalizeBase(basePlaceholder)
  const supportedBases = Array.from(new Set([normalizedBase, normalizedPlaceholderBase]))
  let cachedIndexHtmlPromise

  const loadIndexHtml = () => {
    if (cachedIndexHtmlPromise == null) {
      cachedIndexHtmlPromise = readFile(path.join(distPath, 'index.html'), 'utf8')
        .then((content) => {
          const replacedBase = replaceBase(content, normalizedBase, normalizedPlaceholderBase)
          return replacedBase.replace(
            '</head>',
            `${createRuntimeScript(normalizedBase, runtimeEnv)}</head>`
          )
        })
    }
    return cachedIndexHtmlPromise
  }

  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end()
      return
    }

    const requestPath = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    const trimmedBase = trimTrailingSlash(normalizedBase)
    const trimmedPlaceholderBase = trimTrailingSlash(normalizedPlaceholderBase)

    if (normalizedBase !== '/') {
      if (requestPath === '/' || requestPath === trimmedBase || requestPath === trimmedPlaceholderBase) {
        res.writeHead(308, { Location: normalizedBase })
        res.end()
        return
      }
    }

    const matchedBase = supportedBases.find((candidate) => candidate === '/' || requestPath.startsWith(candidate))
    if (matchedBase == null) {
      sendText(req, res, 404, 'Not Found', 'text/plain; charset=utf-8')
      return
    }

    const relativePath = matchedBase === '/'
      ? requestPath.replace(/^\/+/, '')
      : requestPath.slice(matchedBase.length)

    if (!relativePath || relativePath === 'index.html') {
      const html = await loadIndexHtml()
      sendText(req, res, 200, html, 'text/html; charset=utf-8')
      return
    }

    const resolvedStaticFile = resolveStaticFile(distPath, relativePath)
    if (resolvedStaticFile != null) {
      const extraHeaders = resolvedStaticFile.relativePath === 'sw.js'
        ? { 'Cache-Control': 'no-cache' }
        : {}
      if (await sendFile(req, res, resolvedStaticFile.absolutePath, extraHeaders)) {
        return
      }
    }

    const html = await loadIndexHtml()
    sendText(req, res, 200, html, 'text/html; charset=utf-8')
  }
}

const listen = (server, port, host) =>
  new Promise((resolve, reject) => {
    function onListening() {
      server.off('error', onError)
      resolve(server.address())
    }
    function onError(error) {
      server.off('listening', onListening)
      reject(error)
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

const startPreviewServer = async ({
  base = DEFAULT_CLIENT_BASE,
  basePlaceholder = DEFAULT_BASE_PLACEHOLDER,
  distPath = path.resolve(__dirname, './dist'),
  host = '127.0.0.1',
  port = 4173,
  runtimeEnv = {}
} = {}) => {
  await stat(path.join(distPath, 'index.html'))

  const normalizedBase = normalizeBase(base)
  const server = createServer(
    createPreviewRequestHandler({
      base: normalizedBase,
      basePlaceholder,
      distPath,
      runtimeEnv
    })
  )

  const address = await listen(server, port, host)
  if (address == null || typeof address === 'string') {
    throw new Error('Failed to resolve preview server address')
  }

  const originHost = formatOriginHost(address.address)
  const origin = `http://${originHost}:${address.port}`
  return {
    base: normalizedBase,
    close: () => close(server),
    origin,
    server,
    url: `${origin}${normalizedBase === '/' ? '/' : normalizedBase}`
  }
}

module.exports = {
  DEFAULT_BASE_PLACEHOLDER,
  createPreviewRequestHandler,
  createRuntimeScript,
  normalizeBase,
  replaceBase,
  startPreviewServer
}
