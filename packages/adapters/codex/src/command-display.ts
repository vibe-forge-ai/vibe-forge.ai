import type { CodexCommandValue, CodexStructuredCommand } from '#~/types.js'

const COMMAND_PLACEHOLDER = '[command]'

const stringifyCommandPart = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value == null) return ''

  try {
    const serialized = JSON.stringify(value)
    return serialized ?? String(value)
  } catch {
    return String(value)
  }
}

const normalizeCommandParts = (parts: unknown[]): string[] => (
  parts
    .map(part => stringifyCommandPart(part).trim())
    .filter(part => part !== '')
)

const formatStructuredCommand = (command: CodexStructuredCommand): string => {
  const nestedCommand = formatCodexCommandForDisplay(command.command)
  if (nestedCommand !== COMMAND_PLACEHOLDER) {
    return nestedCommand
  }

  const argv = Array.isArray(command.argv)
    ? command.argv
    : Array.isArray(command.args)
    ? command.args
    : []
  const parts = normalizeCommandParts([
    command.executable,
    ...argv
  ])

  return parts.length > 0 ? parts.join(' ') : COMMAND_PLACEHOLDER
}

export const formatCodexCommandForDisplay = (command: unknown): string => {
  if (Array.isArray(command)) {
    const parts = normalizeCommandParts(command)
    return parts.length > 0 ? parts.join(' ') : COMMAND_PLACEHOLDER
  }

  if (typeof command === 'string') {
    const normalized = command.trim()
    return normalized !== '' ? normalized : COMMAND_PLACEHOLDER
  }

  if (command != null && typeof command === 'object') {
    return formatStructuredCommand(command as CodexCommandValue & CodexStructuredCommand)
  }

  return COMMAND_PLACEHOLDER
}
