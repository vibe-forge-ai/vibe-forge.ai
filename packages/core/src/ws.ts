import type { AskUserQuestionParams, WSEvent as SharedWSEvent, AdapterErrorData, SessionInfo  } from '@vibe-forge/types'


export type WSEvent = SharedWSEvent<AdapterErrorData, SessionInfo, any, AskUserQuestionParams>
