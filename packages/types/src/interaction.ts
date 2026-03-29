interface InteractionOption {
  label: string
  description?: string
}

export interface AskUserQuestionParams {
  sessionId: string
  question: string
  options?: InteractionOption[]
  multiselect?: boolean
}
