import { buildClaudeEditToolPresentation } from './claude-tool-edit-builders'
import { buildClaudeOperationToolPresentation } from './claude-tool-operation-builders'
import { buildClaudeSystemToolPresentation } from './claude-tool-system-builders'
import { buildClaudeTaskToolPresentation } from './claude-tool-task-builders'
import {
  CLAUDE_TOOL_META,
  addDetailsField,
  isRecord
} from './claude-tool-shared'
import type {
  ClaudeToolField,
  ClaudeToolPresentation,
  ClaudeToolQuestion,
  ClaudeToolQuestionOption
} from './claude-tool-shared'

export type { ClaudeToolField, ClaudeToolPresentation, ClaudeToolQuestion, ClaudeToolQuestionOption }

export const getClaudeToolBaseName = (name: string) => (
  name.startsWith('adapter:claude-code:') ? name.slice('adapter:claude-code:'.length) : name
)

export const isClaudeToolName = (name: string) => (
  name.startsWith('adapter:claude-code:') || name in CLAUDE_TOOL_META
)

export function buildClaudeToolPresentation(name: string, input: unknown): ClaudeToolPresentation {
  const baseName = getClaudeToolBaseName(name)
  const meta = CLAUDE_TOOL_META[baseName] ?? {
    titleKey: 'chat.tools.unknown',
    fallbackTitle: baseName,
    icon: 'build'
  }
  const record = isRecord(input) ? input : null
  const fields: ClaudeToolField[] = []
  const usedKeys = new Set<string>()
  const editResult = buildClaudeEditToolPresentation({ baseName, record, fields, usedKeys })
  const operationResult = editResult.handled
    ? { handled: false as const, primary: undefined as string | undefined }
    : buildClaudeOperationToolPresentation({ baseName, record, fields, usedKeys })
  const systemResult = editResult.handled || operationResult.handled
    ? { handled: false as const, primary: undefined as string | undefined }
    : buildClaudeSystemToolPresentation({ baseName, record, fields, usedKeys })
  const taskResult = editResult.handled || operationResult.handled || systemResult.handled
    ? { handled: false as const, primary: undefined as string | undefined }
    : buildClaudeTaskToolPresentation({ baseName, record, fields, usedKeys })
  const primary = editResult.handled
    ? editResult.primary
    : operationResult.handled
      ? operationResult.primary
      : systemResult.handled
        ? systemResult.primary
        : taskResult.primary

  addDetailsField(fields, record, usedKeys)

  return {
    baseName,
    titleKey: meta.titleKey,
    fallbackTitle: meta.fallbackTitle,
    icon: meta.icon,
    primary,
    fields
  }
}
