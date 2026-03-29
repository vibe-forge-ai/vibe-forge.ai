export interface TaskDetail {
  ctxId: string
  sessionId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
  pid?: number
  startTime: number
  endTime?: number
  description?: string
  adapter?: string
  adapterType?: string
  model?: string
  exitCode?: number
}
