import type { AskUserQuestionParams } from './interaction'
import type { ChatMessage } from './message'
import type { SessionMessageQueueState } from './session'

export type WSEvent<
  TAdapterErrorData = unknown,
  TSessionInfo = unknown,
  TSession = unknown,
  TInteractionPayload = AskUserQuestionParams,
> =
  | { type: 'error'; data: TAdapterErrorData; message?: string }
  | { type: 'message'; message: ChatMessage }
  | { type: 'session_info'; info: TSessionInfo }
  | { type: 'tool_result'; toolCallId: string; output: any; isError: boolean }
  | { type: 'adapter_result'; result: any; usage?: any }
  | { type: 'adapter_event'; data: any }
  | { type: 'session_updated'; session: TSession }
  | { type: 'config_updated'; workspaceFolder: string; updatedAt: number }
  | { type: 'session_queue_updated'; queue: SessionMessageQueueState }
  | { type: 'interaction_request'; id: string; payload: TInteractionPayload }
  | { type: 'interaction_response'; id: string; data: string | string[] }
