import { describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/types'

import { AgentMessageAccumulator, CommandOutputAccumulator, handleIncomingNotification } from '#~/protocol/incoming.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockRpc() {
  return { respond: vi.fn() } as any
}

function makeCollector() {
  const events: AdapterOutputEvent[] = []
  const onEvent = (e: AdapterOutputEvent) => events.push(e)
  return { events, onEvent }
}

function dispatch(
  method: string,
  params: Record<string, unknown>,
  {
    approvalPolicy = 'unlessTrusted',
    msgAcc = new AgentMessageAccumulator(),
    cmdAcc = new CommandOutputAccumulator(),
    rpc = makeMockRpc()
  }: {
    approvalPolicy?: string
    msgAcc?: AgentMessageAccumulator
    cmdAcc?: CommandOutputAccumulator
    rpc?: ReturnType<typeof makeMockRpc>
  } = {}
) {
  const { events, onEvent } = makeCollector()
  handleIncomingNotification(method, params, rpc, onEvent, msgAcc, cmdAcc, approvalPolicy)
  return { events, rpc, msgAcc, cmdAcc }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleIncomingNotification', () => {
  // ── Text delta accumulation ────────────────────────────────────────────────

  describe('item/agentMessage/delta', () => {
    it('accumulates text without emitting events', () => {
      const msgAcc = new AgentMessageAccumulator()
      const { events } = dispatch('item/agentMessage/delta', { itemId: 'i1', delta: 'Hello ' }, { msgAcc })
      dispatch('item/agentMessage/delta', { itemId: 'i1', delta: 'world' }, { msgAcc })

      expect(events).toHaveLength(0)
      expect(msgAcc.get('i1')).toBe('Hello world')
    })

    it('tracks separate items independently', () => {
      const msgAcc = new AgentMessageAccumulator()
      dispatch('item/agentMessage/delta', { itemId: 'i1', delta: 'foo' }, { msgAcc })
      dispatch('item/agentMessage/delta', { itemId: 'i2', delta: 'bar' }, { msgAcc })

      expect(msgAcc.get('i1')).toBe('foo')
      expect(msgAcc.get('i2')).toBe('bar')
    })
  })

  // ── item/completed — agentMessage ──────────────────────────────────────────

  describe('item/completed – agentMessage', () => {
    it('emits a message event with accumulated text', () => {
      const msgAcc = new AgentMessageAccumulator()
      msgAcc.append('i1', 'Hello ')
      msgAcc.append('i1', 'world')

      const { events } = dispatch(
        'item/completed',
        { item: { type: 'agentMessage', id: 'i1', text: '' } },
        { msgAcc }
      )

      expect(events).toHaveLength(1)
      const ev = events[0]
      expect(ev.type).toBe('message')
      expect(ev.type === 'message' && ev.data.content).toBe('Hello world')
    })

    it('falls back to item.text when accumulator is empty', () => {
      const { events } = dispatch(
        'item/completed',
        { item: { type: 'agentMessage', id: 'i2', text: 'Fallback text' } }
      )

      expect(events).toHaveLength(1)
      const ev = events[0]
      expect(ev.type === 'message' && ev.data.content).toBe('Fallback text')
    })

    it('does not emit when text is empty', () => {
      const { events } = dispatch(
        'item/completed',
        { item: { type: 'agentMessage', id: 'i3', text: '' } }
      )

      expect(events).toHaveLength(0)
    })

    it('cleans up accumulator entry after emitting', () => {
      const msgAcc = new AgentMessageAccumulator()
      msgAcc.append('i4', 'some text')

      dispatch('item/completed', { item: { type: 'agentMessage', id: 'i4', text: '' } }, { msgAcc })

      expect(msgAcc.get('i4')).toBe('')
    })
  })

  // ── item/started — commandExecution ───────────────────────────────────────

  describe('item/started – commandExecution', () => {
    it('emits a tool_use event for Bash', () => {
      const { events } = dispatch('item/started', {
        item: {
          type: 'commandExecution',
          id: 'cmd1',
          command: ['ls', '-la'],
          cwd: '/tmp',
          status: 'inProgress'
        }
      })

      expect(events).toHaveLength(1)
      const ev = events[0]
      expect(ev.type).toBe('message')
      if (ev.type === 'message') {
        const content = ev.data.content as any[]
        expect(content[0].type).toBe('tool_use')
        expect(content[0].name).toBe('adapter:codex:Bash')
        expect(content[0].input.command).toBe('ls -la')
        expect(content[0].input.cwd).toBe('/tmp')
      }
    })

    it('emits a tool_use event for WebSearch', () => {
      const { events } = dispatch('item/started', {
        item: { type: 'webSearch', id: 'ws1', query: 'openai codex' }
      })

      expect(events).toHaveLength(1)
      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].name).toBe('adapter:codex:WebSearch')
        expect(content[0].input.query).toBe('openai codex')
      }
    })

    it('emits nothing for unknown item types', () => {
      const { events } = dispatch('item/started', {
        item: { type: 'contextCompaction', id: 'cc1' }
      })

      expect(events).toHaveLength(0)
    })
  })

  // ── item/completed — commandExecution ─────────────────────────────────────

  describe('item/completed – commandExecution', () => {
    it('emits a tool_result event with aggregated output', () => {
      const { events } = dispatch('item/completed', {
        item: {
          type: 'commandExecution',
          id: 'cmd1',
          command: ['ls'],
          status: 'completed',
          aggregatedOutput: 'file.txt\n',
          exitCode: 0
        }
      })

      expect(events).toHaveLength(1)
      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].type).toBe('tool_result')
        expect(content[0].tool_use_id).toBe('cmd1')
        expect(content[0].content).toBe('file.txt\n')
        expect(content[0].is_error).toBe(false)
      }
    })

    it('uses accumulated output deltas when aggregatedOutput is absent', () => {
      const cmdAcc = new CommandOutputAccumulator()
      cmdAcc.append('cmd2', 'line1\n')
      cmdAcc.append('cmd2', 'line2\n')

      const { events } = dispatch(
        'item/completed',
        { item: { type: 'commandExecution', id: 'cmd2', command: ['cat'], status: 'completed' } },
        { cmdAcc }
      )

      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].content).toBe('line1\nline2\n')
      }
    })

    it('marks is_error true when exitCode is non-zero', () => {
      const { events } = dispatch('item/completed', {
        item: {
          type: 'commandExecution',
          id: 'cmd3',
          command: ['false'],
          status: 'completed',
          exitCode: 1
        }
      })

      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].is_error).toBe(true)
      }
    })
  })

  // ── item/completed — fileChange ────────────────────────────────────────────

  describe('item/completed – fileChange', () => {
    it('emits a tool_result summarising file changes', () => {
      const { events } = dispatch('item/completed', {
        item: {
          type: 'fileChange',
          id: 'fc1',
          status: 'completed',
          changes: [
            { path: 'src/index.ts', kind: 'edit' },
            { path: 'README.md', kind: 'add' }
          ]
        }
      })

      expect(events).toHaveLength(1)
      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].type).toBe('tool_result')
        expect(content[0].content).toContain('edit src/index.ts')
        expect(content[0].content).toContain('add README.md')
        expect(content[0].is_error).toBe(false)
      }
    })

    it('marks is_error true when status is declined', () => {
      const { events } = dispatch('item/completed', {
        item: { type: 'fileChange', id: 'fc2', status: 'declined', changes: [] }
      })

      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].is_error).toBe(true)
      }
    })
  })

  // ── turn/completed ─────────────────────────────────────────────────────────

  describe('turn/completed', () => {
    it('emits stop when status is completed', () => {
      const { events } = dispatch('turn/completed', {
        turn: { id: 'turn_1', status: 'completed', items: [] }
      })

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('stop')
    })

    it('emits stop when status is interrupted', () => {
      const { events } = dispatch('turn/completed', {
        turn: { id: 'turn_2', status: 'interrupted', items: [] }
      })

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('stop')
    })

    it('emits stop with error message when status is failed', () => {
      const { events } = dispatch('turn/completed', {
        turn: {
          id: 'turn_3',
          status: 'failed',
          items: [],
          error: { message: 'Context window exceeded' }
        }
      })

      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({
        type: 'error',
        data: {
          message: 'Context window exceeded',
          fatal: true
        }
      })
      const ev = events[1]
      expect(ev.type).toBe('stop')
      if (ev.type === 'stop') {
        expect(ev.data?.content).toBe('Context window exceeded')
      }
    })

    it('includes codex turn details in the surfaced failure message', () => {
      const { events } = dispatch('turn/completed', {
        turn: {
          id: 'turn_4',
          status: 'failed',
          items: [],
          error: {
            message: 'Incomplete response returned',
            codexErrorInfo: 'status=incomplete',
            additionalDetails: 'reason=max_output_tokens'
          }
        }
      })

      expect(events[0]).toMatchObject({
        type: 'error',
        data: {
          fatal: true
        }
      })
      const ev = events[1]
      expect(ev.type).toBe('stop')
      if (ev.type === 'stop') {
        expect(ev.data?.content).toContain('Incomplete response returned')
        expect(ev.data?.content).toContain('status=incomplete')
        expect(ev.data?.content).toContain('reason=max_output_tokens')
      }
    })

    it('clears accumulators on completion', () => {
      const msgAcc = new AgentMessageAccumulator()
      const cmdAcc = new CommandOutputAccumulator()
      msgAcc.append('i1', 'text')
      cmdAcc.append('c1', 'output')

      dispatch(
        'turn/completed',
        { turn: { id: 'turn_4', status: 'completed', items: [] } },
        { msgAcc, cmdAcc }
      )

      expect(msgAcc.get('i1')).toBe('')
      expect(cmdAcc.get('c1')).toBe('')
    })
  })

  // ── Approvals ──────────────────────────────────────────────────────────────

  describe('item/commandExecution/requestApproval', () => {
    it('auto-accepts when approvalPolicy is "never"', () => {
      const rpc = makeMockRpc()
      dispatch(
        'item/commandExecution/requestApproval',
        { id: 99, itemId: 'cmd1', threadId: 'thr_1', turnId: 'turn_1', command: ['rm', '-rf', '/'] },
        { approvalPolicy: 'never', rpc }
      )

      expect(rpc.respond).toHaveBeenCalledWith(99, 'accept')
    })

    it('emits ask_user_question when policy is "unlessTrusted"', () => {
      const { events } = dispatch(
        'item/commandExecution/requestApproval',
        {
          itemId: 'cmd2',
          threadId: 'thr_1',
          turnId: 'turn_1',
          command: ['npm', 'test'],
          reason: 'Run test suite'
        },
        { approvalPolicy: 'unlessTrusted' }
      )

      expect(events).toHaveLength(1)
      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].name).toBe('ask_user_question')
        expect(content[0].input.question).toContain('npm test')
        expect(content[0].input.question).toContain('Run test suite')
        expect(content[0].input.options).toHaveLength(3)
      }
    })
  })

  describe('item/fileChange/requestApproval', () => {
    it('auto-accepts when approvalPolicy is "never"', () => {
      const rpc = makeMockRpc()
      dispatch(
        'item/fileChange/requestApproval',
        { id: 7, itemId: 'fc1', threadId: 'thr_1', turnId: 'turn_1' },
        { approvalPolicy: 'never', rpc }
      )

      expect(rpc.respond).toHaveBeenCalledWith(7, 'accept')
    })

    it('emits ask_user_question with file-change message when policy is "onRequest"', () => {
      const { events } = dispatch(
        'item/fileChange/requestApproval',
        { itemId: 'fc2', threadId: 'thr_1', turnId: 'turn_1', reason: 'Update config' },
        { approvalPolicy: 'onRequest' }
      )

      expect(events).toHaveLength(1)
      if (events[0].type === 'message') {
        const content = events[0].data.content as any[]
        expect(content[0].name).toBe('ask_user_question')
        expect(content[0].input.question).toContain('file changes')
        expect(content[0].input.question).toContain('Update config')
      }
    })
  })

  // ── Unrecognised notifications ─────────────────────────────────────────────

  describe('unrecognised methods', () => {
    it('emits no events for unknown methods', () => {
      const { events } = dispatch('codex/event/session_configured', { foo: 'bar' })
      expect(events).toHaveLength(0)
    })
  })
})
