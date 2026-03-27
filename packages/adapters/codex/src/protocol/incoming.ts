import type { ChatMessage } from '@vibe-forge/core'
import type { AdapterQueryOptions } from '@vibe-forge/core/adapter'
import { uuid } from '@vibe-forge/core/utils/uuid'

import type {
  CodexItemAgentMessage,
  CodexItemCommandExecution,
  CodexItemFileChange,
  CodexItemMcpToolCall,
  CodexItemWebSearch,
  CodexTurnStatus,
  CommandExecApprovalParams,
  FileChangeApprovalParams,
  ItemAgentMessageDeltaParams,
  ItemCommandExecutionOutputDeltaParams,
  ItemCompletedParams,
  ItemStartedParams,
  TurnCompletedParams
} from '#~/types.js'
import type { CodexRpcClient } from './rpc'

/**
 * Prefix a tool name with the adapter namespace so the core framework can
 * route tool-use / tool-result events to the correct adapter.
 */
export const prefixToolName = (name: string) => name.startsWith('adapter:codex:') ? name : `adapter:codex:${name}`

/**
 * Accumulator for in-flight agent messages while the turn is active.
 * We buffer text deltas and flush on `item/completed`.
 */
export class AgentMessageAccumulator {
  private textBuffer = new Map<string, string>()

  append(itemId: string, delta: string): void {
    const current = this.textBuffer.get(itemId) ?? ''
    this.textBuffer.set(itemId, current + delta)
  }

  get(itemId: string): string {
    return this.textBuffer.get(itemId) ?? ''
  }

  delete(itemId: string): void {
    this.textBuffer.delete(itemId)
  }

  clear(): void {
    this.textBuffer.clear()
  }
}

/**
 * Accumulator for in-flight command output deltas.
 */
export class CommandOutputAccumulator {
  private outputBuffer = new Map<string, string>()

  append(itemId: string, delta: string): void {
    const current = this.outputBuffer.get(itemId) ?? ''
    this.outputBuffer.set(itemId, current + delta)
  }

  get(itemId: string): string {
    return this.outputBuffer.get(itemId) ?? ''
  }

  delete(itemId: string): void {
    this.outputBuffer.delete(itemId)
  }

  clear(): void {
    this.outputBuffer.clear()
  }
}

/**
 * Handle a single incoming Codex notification and translate it into
 * the vibe-forge `AdapterOutputEvent` model.
 *
 * @param method   - The JSON-RPC notification method name
 * @param params   - The notification params (as raw Record)
 * @param rpc      - The RPC client (used to respond to server-initiated approval requests)
 * @param onEvent  - The event emitter from `AdapterQueryOptions`
 * @param msgAcc   - Agent message text accumulator
 * @param cmdAcc   - Command output accumulator
 * @param approvalPolicy - 'never' | 'unlessTrusted' | 'onRequest'
 */
export const handleIncomingNotification = (
  method: string,
  params: Record<string, unknown>,
  rpc: CodexRpcClient,
  onEvent: AdapterQueryOptions['onEvent'],
  msgAcc: AgentMessageAccumulator,
  cmdAcc: CommandOutputAccumulator,
  approvalPolicy: string = 'unlessTrusted'
): void => {
  const formatTurnErrorMessage = (
    error?: { message?: string | null; codexErrorInfo?: string | null; additionalDetails?: string | null } | null
  ) => {
    const parts = [
      error?.message?.trim(),
      error?.codexErrorInfo?.trim(),
      error?.additionalDetails?.trim()
    ].filter((part): part is string => typeof part === 'string' && part.length > 0)

    return parts.length > 0 ? parts.join('\n') : 'Turn failed'
  }

  // ── Agent message delta ───────────────────────────────────────────────────
  if (method === 'item/agentMessage/delta') {
    const p = params as unknown as ItemAgentMessageDeltaParams
    msgAcc.append(p.itemId, p.delta)
    return
  }

  // ── Command output delta ──────────────────────────────────────────────────
  if (method === 'item/commandExecution/outputDelta') {
    const p = params as unknown as ItemCommandExecutionOutputDeltaParams
    cmdAcc.append(p.itemId, p.delta)
    return
  }

  // ── Item started ──────────────────────────────────────────────────────────
  if (method === 'item/started') {
    const { item } = params as unknown as ItemStartedParams
    if (item.type === 'commandExecution') {
      const cmdItem = item as CodexItemCommandExecution
      // Emit a tool_use event so the client sees the command being kicked off
      const msg: ChatMessage = {
        id: cmdItem.id,
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: cmdItem.id,
          name: prefixToolName('Bash'),
          input: {
            command: cmdItem.command.join(' '),
            cwd: cmdItem.cwd
          }
        }],
        createdAt: Date.now()
      }
      onEvent({ type: 'message', data: msg })
    }
    if (item.type === 'webSearch') {
      const wsItem = item as CodexItemWebSearch
      const msg: ChatMessage = {
        id: wsItem.id,
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: wsItem.id,
          name: prefixToolName('WebSearch'),
          input: { query: wsItem.query }
        }],
        createdAt: Date.now()
      }
      onEvent({ type: 'message', data: msg })
    }
    if (item.type === 'mcpToolCall') {
      const mcpItem = item as CodexItemMcpToolCall
      const msg: ChatMessage = {
        id: mcpItem.id,
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: mcpItem.id,
          name: prefixToolName(`mcp:${mcpItem.server}:${mcpItem.tool}`),
          input: mcpItem.arguments ?? {}
        }],
        createdAt: Date.now()
      }
      onEvent({ type: 'message', data: msg })
    }
    return
  }

  // ── Item completed ────────────────────────────────────────────────────────
  if (method === 'item/completed') {
    const { item } = params as unknown as ItemCompletedParams

    if (item.type === 'agentMessage') {
      const agentItem = item as CodexItemAgentMessage
      // Use accumulated text if present, otherwise fall back to item.text
      const text = msgAcc.get(agentItem.id) || agentItem.text
      msgAcc.delete(agentItem.id)
      if (text) {
        const msg: ChatMessage = {
          id: agentItem.id,
          role: 'assistant',
          content: text,
          createdAt: Date.now()
        }
        onEvent({ type: 'message', data: msg })
      }
    }

    if (item.type === 'commandExecution') {
      const cmdItem = item as CodexItemCommandExecution
      const output = cmdAcc.get(cmdItem.id) || cmdItem.aggregatedOutput || ''
      cmdAcc.delete(cmdItem.id)
      const resultMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: [{
          type: 'tool_result',
          tool_use_id: cmdItem.id,
          content: output !== ''
            ? output
            : `[exited ${cmdItem.exitCode ?? 0}]`,
          is_error: cmdItem.exitCode != null && cmdItem.exitCode !== 0
        }],
        createdAt: Date.now()
      }
      onEvent({ type: 'message', data: resultMsg })
    }

    if (item.type === 'fileChange') {
      const fcItem = item as CodexItemFileChange
      const summary = fcItem.changes
        .map(c => `${c.kind} ${c.path}`)
        .join('\n')
      const resultMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: [{
          type: 'tool_result',
          tool_use_id: fcItem.id,
          content: summary || `[file changes ${fcItem.status}]`,
          is_error: fcItem.status === 'failed' || fcItem.status === 'declined'
        }],
        createdAt: Date.now()
      }
      onEvent({ type: 'message', data: resultMsg })
    }

    if (item.type === 'mcpToolCall') {
      const mcpItem = item as CodexItemMcpToolCall
      const resultMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: [{
          type: 'tool_result',
          tool_use_id: mcpItem.id,
          content: mcpItem.result ?? (mcpItem.error ? String(mcpItem.error) : '[done]'),
          is_error: mcpItem.status === 'failed'
        }],
        createdAt: Date.now()
      }
      onEvent({ type: 'message', data: resultMsg })
    }

    return
  }

  // ── Command execution approval ─────────────────────────────────────────────
  if (method === 'item/commandExecution/requestApproval') {
    const p = params as unknown as CommandExecApprovalParams & { id?: number }
    // If the approval policy is 'never', auto-accept
    if (approvalPolicy === 'never') {
      // Codex expects us to respond to the server request
      // The approval request comes in as a server-initiated JSON-RPC request
      // with an `id`. We use the rpc.respond() method.
      if (typeof (params as any).id === 'number') {
        rpc.respond((params as any).id as number, 'accept')
      }
      return
    }
    // For other policies, emit an ask_user_question event via the tool mechanism
    const commandStr = p.command?.join(' ') ?? '[command]'
    const msg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: `approval:${p.itemId}`,
        name: 'ask_user_question',
        input: {
          question: `Allow command execution?\n\`${commandStr}\`\n${p.reason ? `Reason: ${p.reason}` : ''}`.trim(),
          options: [
            { label: 'Accept', description: 'Run this command' },
            { label: 'Accept for session', description: 'Auto-accept similar commands this session' },
            { label: 'Decline', description: 'Skip this command' }
          ]
        }
      }],
      createdAt: Date.now()
    }
    onEvent({ type: 'message', data: msg })
    return
  }

  // ── File change approval ───────────────────────────────────────────────────
  if (method === 'item/fileChange/requestApproval') {
    const p = params as unknown as FileChangeApprovalParams
    if (approvalPolicy === 'never') {
      if (typeof (params as any).id === 'number') {
        rpc.respond((params as any).id as number, 'accept')
      }
      return
    }
    const msg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: `approval:${p.itemId}`,
        name: 'ask_user_question',
        input: {
          question: `Allow file changes?${p.reason ? `\nReason: ${p.reason}` : ''}`,
          options: [
            { label: 'Accept', description: 'Apply these file changes' },
            { label: 'Accept for session', description: 'Auto-accept all file changes this session' },
            { label: 'Decline', description: 'Skip these file changes' }
          ]
        }
      }],
      createdAt: Date.now()
    }
    onEvent({ type: 'message', data: msg })
    return
  }

  // ── Turn completed ────────────────────────────────────────────────────────
  if (method === 'turn/completed') {
    const { turn } = params as unknown as TurnCompletedParams
    const status: CodexTurnStatus = turn.status
    if (status === 'completed' || status === 'interrupted') {
      msgAcc.clear()
      cmdAcc.clear()
      onEvent({ type: 'stop', data: undefined })
    } else if (status === 'failed') {
      const errorMsg = formatTurnErrorMessage(turn.error)
      onEvent({
        type: 'error',
        data: {
          message: errorMsg,
          details: turn.error,
          fatal: true
        }
      })
      const data: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: errorMsg,
        createdAt: Date.now()
      }
      onEvent({ type: 'stop', data })
    }
    
  }
}
