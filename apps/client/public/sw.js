const CACHE_PREFIX = 'vibe-forge-web'
const CACHE_VERSION = 'v1'
const APP_CACHE = `${CACHE_PREFIX}-app-${CACHE_VERSION}`
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`
const serviceWorkerGlobal = globalThis

const appScopeUrl = new URL(serviceWorkerGlobal.registration.scope)

const isSameOrigin = url => url.origin === serviceWorkerGlobal.location.origin

const isInsideAppScope = url => url.href.startsWith(appScopeUrl.href)

const isStaticAssetRequest = url => (
  url.pathname.includes('/assets/') ||
  url.pathname.endsWith('/favicon.svg') ||
  url.pathname.endsWith('/manifest.webmanifest') ||
  url.pathname.endsWith('/pwa-icon-192.png') ||
  url.pathname.endsWith('/pwa-icon-512.png')
)

const pruneOldCaches = async () => {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== APP_CACHE && name !== STATIC_CACHE)
      .map(name => caches.delete(name))
  )
}

const cacheAppShell = async () => {
  const cache = await caches.open(APP_CACHE)
  try {
    await cache.add(new Request(appScopeUrl.href, { cache: 'reload' }))
  } catch {
    // Installing should still succeed if the first shell refresh races the network.
  }
}

const networkFirstNavigation = async request => {
  const cache = await caches.open(APP_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(appScopeUrl.href, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(appScopeUrl.href)
    if (cached != null) {
      return cached
    }
    throw error
  }
}

const staleWhileRevalidate = async request => {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  const networkResponse = fetch(request)
    .then(async response => {
      if (response.ok) {
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(error => {
      if (cached != null) {
        return cached
      }
      throw error
    })

  return cached ?? networkResponse
}

serviceWorkerGlobal.addEventListener('install', event => {
  event.waitUntil(
    cacheAppShell()
      .then(() => serviceWorkerGlobal.skipWaiting())
  )
})

serviceWorkerGlobal.addEventListener('activate', event => {
  event.waitUntil(
    pruneOldCaches()
      .then(() => serviceWorkerGlobal.clients.claim())
  )
})

serviceWorkerGlobal.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!isSameOrigin(url) || !isInsideAppScope(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isStaticAssetRequest(url)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
