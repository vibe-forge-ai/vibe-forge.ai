import { Option } from 'commander'

import { normalizeAdapterPackageId } from '@vibe-forge/types'

const ADAPTER_PREFIX = 'adapter-'

export const normalizeCliAdapterOptionValue = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === '') return trimmed

  const normalized = normalizeAdapterPackageId(trimmed)
  return normalized.startsWith(ADAPTER_PREFIX)
    ? normalized.slice(ADAPTER_PREFIX.length)
    : normalized
}

export const createAdapterOption = (description: string) => (
  new Option('-A, --adapter <adapter>', description)
    .argParser(normalizeCliAdapterOptionValue)
)
