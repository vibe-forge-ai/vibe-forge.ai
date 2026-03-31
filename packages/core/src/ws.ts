import type { AdapterErrorData, AskUserQuestionParams, SessionInfo, WSEvent as SharedWSEvent } from '@vibe-forge/types'

export type WSEvent = SharedWSEvent<AdapterErrorData, SessionInfo, any, AskUserQuestionParams>
