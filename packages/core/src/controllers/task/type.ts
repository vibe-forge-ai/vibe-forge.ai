export interface RunTaskOptions {
  taskId?: string
  taskAdapter?: string
  env?: Record<string, string | undefined | null>
  cwd?: string
}
