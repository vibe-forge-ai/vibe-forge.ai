import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveWebAuthConfig = vi.fn()
const verifySessionToken = vi.fn()

vi.mock('#~/services/auth/index.js', () => ({
  AUTH_COOKIE_NAME: 'vf_web_auth',
  resolveWebAuthConfig,
  verifySessionToken
}))

const createCtx = (path = '/api/sessions') => ({
  path,
  cookies: {
    get: vi.fn(() => 'token')
  }
})

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips public auth routes', async () => {
    const { authMiddleware } = await import('#~/middlewares/auth.js')
    const next = vi.fn()

    await authMiddleware({} as any)(createCtx('/api/auth/status') as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(resolveWebAuthConfig).not.toHaveBeenCalled()
  })

  it('rejects protected api routes when auth is enabled and token is invalid', async () => {
    resolveWebAuthConfig.mockResolvedValueOnce({ enabled: true })
    verifySessionToken.mockResolvedValueOnce(false)
    const { authMiddleware } = await import('#~/middlewares/auth.js')

    await expect(authMiddleware({} as any)(createCtx() as any, vi.fn())).rejects.toMatchObject({
      status: 401,
      code: 'auth_required'
    })
  })

  it('allows protected api routes when auth is disabled', async () => {
    resolveWebAuthConfig.mockResolvedValueOnce({ enabled: false })
    const next = vi.fn()
    const { authMiddleware } = await import('#~/middlewares/auth.js')

    await authMiddleware({} as any)(createCtx() as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(verifySessionToken).not.toHaveBeenCalled()
  })
})
