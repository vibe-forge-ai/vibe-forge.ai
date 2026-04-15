export interface GeminiRunShellCommandInput {
  command: string
  description?: string
}

export interface GeminiReadFileInput {
  path: string
  line?: number
  limit?: number
}

export interface GeminiWriteFileInput {
  path: string
  content: string
}

export interface GeminiReplaceInput {
  path: string
  oldText: string
  newText: string
}

export interface GeminiListDirectoryInput {
  path?: string
}

export interface GeminiGlobInput {
  pattern: string
  path?: string
}

export interface GeminiWebSearchInput {
  query: string
}

export interface GeminiWebFetchInput {
  url: string
}

export interface GeminiActivateSkillInput {
  name: string
}

export interface GeminiSaveMemoryInput {
  fact: string
}

declare module '@vibe-forge/core' {
  interface ToolInputs {
    'adapter:gemini:RunShellCommand': GeminiRunShellCommandInput
    'adapter:gemini:ReadFile': GeminiReadFileInput
    'adapter:gemini:WriteFile': GeminiWriteFileInput
    'adapter:gemini:Replace': GeminiReplaceInput
    'adapter:gemini:ListDirectory': GeminiListDirectoryInput
    'adapter:gemini:Glob': GeminiGlobInput
    'adapter:gemini:WebSearch': GeminiWebSearchInput
    'adapter:gemini:WebFetch': GeminiWebFetchInput
    'adapter:gemini:ActivateSkill': GeminiActivateSkillInput
    'adapter:gemini:SaveMemory': GeminiSaveMemoryInput
  }
}
