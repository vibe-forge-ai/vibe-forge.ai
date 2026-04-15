import { afterEach, describe, expect, it } from 'vitest'

import { getParentSessionId } from '#~/sync.js'

describe('mcp sync helpers', () => {
  afterEach(() => {
    delete process.env.__VF_PROJECT_AI_SESSION_ID__
    delete process.env.__VF_PROJECT_AI_CTX_ID__
  })

  it('prefers the current session id when resolving the parent session id', () => {
    process.env.__VF_PROJECT_AI_SESSION_ID__ = 'session-parent'
    process.env.__VF_PROJECT_AI_CTX_ID__ = 'ctx-parent'

    expect(getParentSessionId()).toBe('session-parent')
  })

  it('falls back to ctx id when the session id is missing', () => {
    process.env.__VF_PROJECT_AI_CTX_ID__ = 'ctx-parent'

    expect(getParentSessionId()).toBe('ctx-parent')
  })
})
