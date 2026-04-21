import { afterEach, describe, expect, it } from 'vitest'

import { normalizeTerminalId, resolveTerminalRuntimeKey } from '#~/services/terminal/ids.js'
import { disposeTerminalSession } from '#~/services/terminal/index.js'
import { ensureTerminalRuntime, terminalRuntimeStore } from '#~/services/terminal/store.js'

describe('terminal runtime store', () => {
  afterEach(() => {
    terminalRuntimeStore.clear()
  })

  it('keeps multiple terminal runtimes for one chat session', () => {
    const first = ensureTerminalRuntime('sess-1', {
      terminalId: 'one',
      shellKind: 'zsh',
      cwd: '/tmp/workspace'
    })
    const second = ensureTerminalRuntime('sess-1', {
      terminalId: 'two',
      cwd: '/tmp/workspace'
    })

    expect(first).not.toBe(second)
    expect(first.info.sessionId).toBe('sess-1')
    expect(first.info.terminalId).toBe('one')
    expect(first.info.shellKind).toBe('zsh')
    expect(second.info.sessionId).toBe('sess-1')
    expect(second.info.terminalId).toBe('two')
    expect(terminalRuntimeStore.get(resolveTerminalRuntimeKey('sess-1', 'one'))).toBe(first)
    expect(terminalRuntimeStore.get(resolveTerminalRuntimeKey('sess-1', 'two'))).toBe(second)
  })

  it('preserves the default runtime key for existing single terminal sessions', () => {
    expect(normalizeTerminalId('')).toBe('default')
    expect(normalizeTerminalId('pane 1')).toBe('pane-1')
    expect(resolveTerminalRuntimeKey('sess-1')).toBe('sess-1')
    expect(resolveTerminalRuntimeKey('sess-1', 'default')).toBe('sess-1')
  })

  it('keeps an existing terminal cwd when later updates omit cwd', () => {
    const runtime = ensureTerminalRuntime('sess-1', {
      cwd: '/tmp/session-workspace'
    })

    ensureTerminalRuntime('sess-1', {
      cols: 100,
      rows: 30
    })

    expect(runtime.info.cwd).toBe('/tmp/session-workspace')
    expect(runtime.info.cols).toBe(100)
    expect(runtime.info.rows).toBe(30)
  })

  it('disposes every terminal runtime owned by a chat session', () => {
    const first = ensureTerminalRuntime('sess-1', {
      terminalId: 'one',
      cwd: '/tmp/workspace'
    })
    const second = ensureTerminalRuntime('sess-1', {
      terminalId: 'two',
      cwd: '/tmp/workspace'
    })
    const other = ensureTerminalRuntime('sess-2', {
      terminalId: 'one',
      cwd: '/tmp/workspace'
    })

    disposeTerminalSession('sess-1')

    expect(terminalRuntimeStore.has(first.runtimeKey)).toBe(false)
    expect(terminalRuntimeStore.has(second.runtimeKey)).toBe(false)
    expect(terminalRuntimeStore.get(other.runtimeKey)).toBe(other)
  })
})
