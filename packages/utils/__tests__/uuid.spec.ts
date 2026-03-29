import { describe, expect, it } from 'vitest'

import { uuid } from '#~/uuid.js'

describe('uuid helper', () => {
  it('creates RFC4122 v4-shaped ids', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
