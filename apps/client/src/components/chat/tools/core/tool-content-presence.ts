import { toSerializable } from '#~/utils/safe-serialize'

import { getStringList, getStructuredBlocks } from './tool-result-content-utils'

const parseStructuredInput = (value: unknown) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }

  return value
}

export const hasMeaningfulToolValue = (value: unknown): boolean => {
  const parsed = parseStructuredInput(toSerializable(value))

  if (parsed == null) {
    return false
  }

  if (typeof parsed === 'string') {
    return parsed.trim() !== ''
  }

  if (typeof parsed === 'number' || typeof parsed === 'boolean') {
    return true
  }

  if (Array.isArray(parsed)) {
    return parsed.some(item => hasMeaningfulToolValue(item))
  }

  if (typeof parsed !== 'object') {
    return false
  }

  if (getStructuredBlocks(parsed) != null) {
    return true
  }

  if (getStringList(parsed) != null) {
    return true
  }

  return Object.values(parsed as Record<string, unknown>).some(item => hasMeaningfulToolValue(item))
}

