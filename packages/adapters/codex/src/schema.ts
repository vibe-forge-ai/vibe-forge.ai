// Codex tool input/output schemas
// Augments @vibe-forge/core ToolInputs / ToolOutputs so Codex tools are
// available across the platform with their codex-specific names.

// ─── Input schemas ─────────────────────────────────────────────────────────────

export interface CodexBashToolInput {
  command: string
  cwd?: string
  timeoutMs?: number
}

export interface CodexReadFileToolInput {
  path: string
  startLine?: number
  endLine?: number
}

export interface CodexWriteFileToolInput {
  path: string
  content: string
}

export interface CodexEditFileToolInput {
  path: string
  oldString: string
  newString: string
}

export interface CodexGlobToolInput {
  pattern: string
  cwd?: string
}

export interface CodexGrepToolInput {
  pattern: string
  path?: string
  glob?: string
  ignoreCase?: boolean
  contextLines?: number
}

export interface CodexListDirToolInput {
  path: string
}

export interface CodexWebSearchToolInput {
  query: string
}

export interface CodexWebFetchToolInput {
  url: string
}

export interface CodexApplyPatchToolInput {
  patch: string
  cwd?: string
}

// ─── Output schemas ────────────────────────────────────────────────────────────

export interface CodexBashToolOutput {
  exitCode: number
  stdout: string
  stderr: string
}

export interface CodexReadFileToolOutput {
  content: string
}

export interface CodexGlobToolOutput {
  files: string[]
}

export interface CodexGrepToolOutput {
  matches: Array<{ file: string; line: number; text: string }>
}

export interface CodexListDirToolOutput {
  entries: Array<{ name: string; type: 'file' | 'directory'; size?: number }>
}

export interface CodexWebSearchToolOutput {
  results: Array<{ title: string; url: string; snippet: string }>
}

// ─── Module augmentation ───────────────────────────────────────────────────────

declare module '@vibe-forge/core' {
  interface ToolInputs {
    'adapter:codex:Bash': CodexBashToolInput
    'adapter:codex:ReadFile': CodexReadFileToolInput
    'adapter:codex:WriteFile': CodexWriteFileToolInput
    'adapter:codex:EditFile': CodexEditFileToolInput
    'adapter:codex:Glob': CodexGlobToolInput
    'adapter:codex:Grep': CodexGrepToolInput
    'adapter:codex:ListDir': CodexListDirToolInput
    'adapter:codex:WebSearch': CodexWebSearchToolInput
    'adapter:codex:WebFetch': CodexWebFetchToolInput
    'adapter:codex:ApplyPatch': CodexApplyPatchToolInput
  }

  interface ToolOutputs {
    'adapter:codex:Bash': CodexBashToolOutput
    'adapter:codex:ReadFile': CodexReadFileToolOutput
    'adapter:codex:Glob': CodexGlobToolOutput
    'adapter:codex:Grep': CodexGrepToolOutput
    'adapter:codex:ListDir': CodexListDirToolOutput
    'adapter:codex:WebSearch': CodexWebSearchToolOutput
  }
}
