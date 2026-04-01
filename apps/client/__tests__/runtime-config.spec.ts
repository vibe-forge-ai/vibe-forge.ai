import { describe, expect, it } from 'vitest'

import { resolveClientBase } from '#~/runtime-config'

describe('runtime config', () => {
  it('prefers explicit runtime config, then custom env, then vite base url, then /ui', () => {
    expect(resolveClientBase('/runtime', '/custom', '/vite', '/ui')).toBe('/runtime')
    expect(resolveClientBase(undefined, '/custom', '/vite', '/ui')).toBe('/custom')
    expect(resolveClientBase(undefined, undefined, '/vite/', '/ui')).toBe('/vite')
    expect(resolveClientBase(undefined, undefined, undefined, '/ui')).toBe('/ui')
  })

  it('ignores blank values and normalizes trailing slashes', () => {
    expect(resolveClientBase('   ', '/custom/', '/vite/', '/ui')).toBe('/custom')
    expect(resolveClientBase(undefined, '', '/', '/ui')).toBe('/')
  })
})
