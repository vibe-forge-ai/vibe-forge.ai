import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import Router from '@koa/router'
import send from 'koa-send'

const replaceBase = (content: string, base: string, placeholder: string) => {
  if (!placeholder || placeholder === base) {
    return content
  }
  return content.split(placeholder).join(base)
}

const resolveStaticPath = (distPath: string, requestPath: string) => {
  const relativePath = requestPath.replace(/^\/+/, '')
  if (!relativePath || relativePath === 'index.html' || relativePath.includes('\0')) {
    return null
  }

  const absolutePath = path.resolve(distPath, relativePath)
  const pathFromRoot = path.relative(distPath, absolutePath)
  if (pathFromRoot.startsWith('..') || path.isAbsolute(pathFromRoot)) {
    return null
  }

  return {
    absolutePath,
    relativePath
  }
}

export interface ClientStaticOptions {
  base: string
  basePlaceholder: string
  distPath: string
  runtimeScript: string
}

export const uiRouter = ({
  base,
  basePlaceholder,
  distPath,
  runtimeScript
}: ClientStaticOptions) => {
  const router = new Router()
  let cachedIndexHtml: string | null = null

  const sendStaticFile = async (ctx: Router.RouterContext, requestPath: string) => {
    const resolved = resolveStaticPath(distPath, requestPath)
    if (resolved == null) return false

    const fileStat = await stat(resolved.absolutePath).catch(() => null)
    if (fileStat == null || !fileStat.isFile()) return false

    if (resolved.relativePath === 'sw.js') {
      ctx.set('Cache-Control', 'no-cache')
    }
    if (resolved.relativePath.endsWith('.webmanifest')) {
      ctx.type = 'application/manifest+json'
    }

    await send(ctx, resolved.relativePath, { root: distPath })
    return true
  }

  const loadIndexHtml = async () => {
    if (cachedIndexHtml) return cachedIndexHtml

    const raw = await readFile(
      path.join(distPath, 'index.html'),
      'utf8'
    )
    const replaced = replaceBase(
      raw,
      base,
      basePlaceholder
    )
    cachedIndexHtml = replaced
      .replace('</head>', `${runtimeScript}</head>`)
    return cachedIndexHtml
  }

  router.get('assets/:path(.*)', async (ctx) => {
    try {
      const assetPath = ctx.params.path
        ? `assets/${ctx.params.path}`
        : 'assets'
      await send(ctx, assetPath, { root: distPath })
      if (!ctx.body) {
        ctx.status = 404
        ctx.body = { error: 'Asset not found' }
      }
    } catch (err) {
      console.error('[ui] Failed to serve asset:', err)
      ctx.status = 404
      ctx.body = { error: 'Asset not found' }
    }
  })

  const handleIndex = async (ctx: Router.RouterContext) => {
    try {
      const html = await loadIndexHtml()
      ctx.type = 'text/html'
      ctx.body = html
    } catch (err) {
      console.error('[ui] Failed to load index.html:', err)
      ctx.status = 500
      ctx.body = { error: 'Failed to load UI' }
    }
  }

  router.get('/', handleIndex)
  router.get(':path(.*)', async (ctx) => {
    const requestPath = ctx.params.path ?? ''
    if (await sendStaticFile(ctx, requestPath)) return

    await handleIndex(ctx)
  })

  return router
}
