import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveWebAuthConfig = vi.fn()
const verifySessionToken = vi.fn()
const getBearerTokenFromHeader = vi.fn()

vi.mock('#~/services/auth/index.js', () => ({
  AUTH_COOKIE_NAME: 'vf_web_auth',
  getBearerTokenFromHeader,
  resolveWebAuthConfig,
  verifySessionToken
}))

const createCtx = (path = '/api/sessions', authorization = '') => ({
  path,
  get: vi.fn((name: string) => name === 'Authorization' ? authorization : ''),
  cookies: {
    get: vi.fn(() => 'token')
  }
})

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBearerTokenFromHeader.mockReturnValue(undefined)
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

  it('accepts bearer tokens on protected api routes', async () => {
    resolveWebAuthConfig.mockResolvedValueOnce({ enabled: true })
    getBearerTokenFromHeader.mockReturnValueOnce('bearer-token')
    verifySessionToken.mockResolvedValueOnce(true)
    const next = vi.fn()
    const { authMiddleware } = await import('#~/middlewares/auth.js')

    await authMiddleware({} as any)(createCtx('/api/sessions', 'Bearer bearer-token') as any, next)

    expect(verifySessionToken).toHaveBeenCalledWith(expect.anything(), 'bearer-token')
    expect(next).toHaveBeenCalledOnce()
  })
})
