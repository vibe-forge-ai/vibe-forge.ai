const normalizeBasePath = (clientBase: string) => {
  const trimmed = clientBase.trim()
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const getServiceWorkerRegistration = (clientBase: string) => {
  const scope = normalizeBasePath(clientBase)
  return {
    scope,
    url: `${scope}sw.js`
  }
}

const unregisterDevServiceWorker = async (scope: string) => {
  if (typeof navigator.serviceWorker.getRegistrations !== 'function') return

  const scopeUrl = new URL(scope, window.location.origin).href
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations
      .filter(registration => registration.scope === scopeUrl)
      .map(registration => registration.unregister())
  )
}

export const setupPwa = (input: {
  clientBase: string
  isProd: boolean
}) => {
  if (!('serviceWorker' in navigator)) return

  const registration = getServiceWorkerRegistration(input.clientBase)
  if (!input.isProd) {
    void unregisterDevServiceWorker(registration.scope)
    return
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(registration.url, { scope: registration.scope })
      .catch((error: unknown) => {
        console.warn('[pwa] service worker registration failed', error)
      })
  })
}
