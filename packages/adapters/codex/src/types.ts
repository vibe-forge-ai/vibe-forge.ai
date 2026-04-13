// ─── JSON-RPC 2.0 base shapes ────────────────────────────────────────────────

export interface CodexRequest {
  method: string
  id: number
  params?: Record<string, unknown>
}

export interface CodexNotification {
  method: string
  params?: Record<string, unknown>
}

export interface CodexResponse {
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// ─── Thread types ─────────────────────────────────────────────────────────────

export type CodexThreadStatus =
  | { type: 'notLoaded' }
  | { type: 'idle' }
  | { type: 'systemError' }
  | { type: 'active'; activeFlags?: string[] }

export interface CodexThread {
  id: string
  name?: string | null
  preview?: string
  ephemeral?: boolean
  modelProvider?: string
  createdAt?: number
  updatedAt?: number
  status?: CodexThreadStatus
}

// ─── Turn types ───────────────────────────────────────────────────────────────

export type CodexTurnStatus = 'inProgress' | 'completed' | 'interrupted' | 'failed'

export interface CodexTurn {
  id: string
  status: CodexTurnStatus
  items: CodexThreadItem[]
  error?: {
    message: string
    codexErrorInfo?: string
    additionalDetails?: string
  } | null
}

// ─── Thread item types ────────────────────────────────────────────────────────

export interface CodexItemUserMessage {
  type: 'userMessage'
  id: string
  content: Array<{ type: 'text'; text: string } | { type: 'image'; url: string }>
}

export interface CodexItemAgentMessage {
  type: 'agentMessage'
  id: string
  text: string
  phase?: 'commentary' | 'final_answer'
}

export interface CodexItemPlan {
  type: 'plan'
  id: string
  text: string
}

export interface CodexItemReasoning {
  type: 'reasoning'
  id: string
  summary: string
  content?: string
}

export interface CodexCommandAction {
  type: string
  path?: string
  content?: string
}

export interface CodexStructuredCommand {
  executable?: string
  args?: unknown[]
  argv?: unknown[]
  command?: unknown
}

export type CodexCommandValue =
  | string
  | string[]
  | CodexStructuredCommand

export interface CodexItemCommandExecution {
  type: 'commandExecution'
  id: string
  command: CodexCommandValue
  cwd?: string
  status: 'inProgress' | 'completed' | 'failed' | 'declined'
  commandActions?: CodexCommandAction[]
  aggregatedOutput?: string
  exitCode?: number
  durationMs?: number
}

export interface CodexFileChange {
  path: string
  kind: 'add' | 'edit' | 'delete' | 'rename'
  diff?: string
}

export interface CodexItemFileChange {
  type: 'fileChange'
  id: string
  changes: CodexFileChange[]
  status: 'inProgress' | 'completed' | 'failed' | 'declined'
}

export interface CodexItemMcpToolCall {
  type: 'mcpToolCall'
  id: string
  server: string
  tool: string
  status: 'inProgress' | 'completed' | 'failed'
  arguments?: Record<string, unknown>
  result?: unknown
  error?: unknown
}

export interface CodexItemDynamicToolCall {
  type: 'dynamicToolCall'
  id: string
  tool: string
  arguments?: Record<string, unknown>
  status: 'inProgress' | 'completed' | 'failed'
  contentItems?: unknown[]
  success?: boolean
  durationMs?: number
}

export interface CodexItemWebSearch {
  type: 'webSearch'
  id: string
  query: string
  action?: {
    type: 'search' | 'openPage' | 'findInPage'
    url?: string
    query?: string
    pattern?: string
  }
}

export interface CodexItemEnteredReviewMode {
  type: 'enteredReviewMode'
  id: string
  review: string
}

export interface CodexItemExitedReviewMode {
  type: 'exitedReviewMode'
  id: string
  review: string
}

export interface CodexItemContextCompaction {
  type: 'contextCompaction'
  id: string
}

export type CodexThreadItem =
  | CodexItemUserMessage
  | CodexItemAgentMessage
  | CodexItemPlan
  | CodexItemReasoning
  | CodexItemCommandExecution
  | CodexItemFileChange
  | CodexItemMcpToolCall
  | CodexItemDynamicToolCall
  | CodexItemWebSearch
  | CodexItemEnteredReviewMode
  | CodexItemExitedReviewMode
  | CodexItemContextCompaction

// ─── Notification param types ─────────────────────────────────────────────────

export interface TurnStartedParams {
  turn: CodexTurn
}

export interface TurnCompletedParams {
  turn: CodexTurn
}

export interface TurnDiffUpdatedParams {
  threadId: string
  turnId: string
  diff: string
}

export interface TurnPlanUpdatedParams {
  turnId: string
  explanation?: string
  plan: Array<{ step: string; status: 'pending' | 'inProgress' | 'completed' }>
}

export interface ItemStartedParams {
  item: CodexThreadItem
}

export interface ItemCompletedParams {
  item: CodexThreadItem
}

export interface ItemAgentMessageDeltaParams {
  itemId: string
  delta: string
}

export interface ItemCommandExecutionOutputDeltaParams {
  itemId: string
  delta: string
  stream?: 'stdout' | 'stderr'
}

export interface ItemPlanDeltaParams {
  itemId: string
  delta: string
}

export interface ItemReasoningDeltaParams {
  itemId: string
  delta: string
  summaryIndex?: number
}

// ─── Approval request types ───────────────────────────────────────────────────

export interface CommandExecApprovalParams {
  itemId: string
  threadId: string
  turnId: string
  reason?: string
  command?: CodexCommandValue
  cwd?: string
  commandActions?: CodexCommandAction[]
  proposedExecpolicyAmendment?: unknown
  networkApprovalContext?: {
    host: string
    protocol?: string
    port?: number
  }
  availableDecisions?: string[]
}

export interface FileChangeApprovalParams {
  itemId: string
  threadId: string
  turnId: string
  reason?: string
  grantRoot?: string
}

export interface McpServerElicitationRequestMeta {
  codex_approval_kind?: string
  persist?: string[]
  tool_title?: string
  tool_description?: string
  tool_params?: Record<string, unknown>
  tool_params_display?: unknown[]
}

export interface McpServerElicitationRequestParams {
  threadId: string
  turnId: string
  serverName: string
  mode?: string
  _meta?: McpServerElicitationRequestMeta
  message?: string
  requestedSchema?: Record<string, unknown>
}

export type CommandExecDecision =
  | 'accept'
  | 'acceptForSession'
  | 'decline'
  | 'cancel'
  | { acceptWithExecpolicyAmendment: { execpolicy_amendment: string[] } }

export type FileChangeDecision = 'accept' | 'acceptForSession' | 'decline' | 'cancel'
export type McpServerElicitationDecision = 'accept' | 'reject' | 'cancel'

export interface CommandExecutionRequestApprovalResponse {
  decision: CommandExecDecision
}

export interface FileChangeRequestApprovalResponse {
  decision: FileChangeDecision
}

export interface McpServerElicitationResponse {
  action: McpServerElicitationDecision
  content?: Record<string, unknown>
}

// ─── Codex input item types ────────────────────────────────────────────────────

export type CodexInputItem =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'localImage'; path: string }
  | { type: 'skill'; name: string; path: string }
  | { type: 'mention'; name: string; path: string }

// ─── Sandbox policy ────────────────────────────────────────────────────────────

export type CodexSandboxPolicy =
  | {
    type: 'readOnly'
    access?: { type: 'fullAccess' } | {
      type: 'restricted'
      includePlatformDefaults?: boolean
      readableRoots?: string[]
    }
  }
  | {
    type: 'workspaceWrite'
    writableRoots?: string[]
    networkAccess?: boolean
    readOnlyAccess?: { type: 'fullAccess' } | {
      type: 'restricted'
      includePlatformDefaults?: boolean
      readableRoots?: string[]
    }
  }
  | { type: 'dangerFullAccess' }
  | { type: 'externalSandbox'; networkAccess?: 'restricted' | 'enabled' }
