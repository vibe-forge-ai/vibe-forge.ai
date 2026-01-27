import type { SessionInfo } from './adapter/index.js'
import type { AskUserQuestionParams } from './types.js'
import type { ChatMessage } from './types.js'

export type WSEvent =
  | { type: 'error'; message: string }
  | { type: 'message'; message: ChatMessage }
  | { type: 'session_info'; info: SessionInfo }
  | { type: 'tool_result'; toolCallId: string; output: any; isError: boolean }
  | { type: 'adapter_result'; result: any; usage?: any }
  | { type: 'adapter_event'; data: any }
  | { type: 'session_updated'; session: any }
  | { type: 'interaction_request'; id: string; payload: AskUserQuestionParams }
  | { type: 'interaction_response'; id: string; data: string | string[] }
