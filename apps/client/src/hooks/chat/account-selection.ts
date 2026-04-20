import { normalizeNonEmptyString } from './model-selector'
import type { ChatAdapterAccountOption } from './use-chat-adapter-account-selection'

const normalizeLabel = (value: string | undefined) => normalizeNonEmptyString(value)?.toLowerCase()

export const resolveChatAdapterAccountKey = (params: {
  value?: string
  accountOptions: ChatAdapterAccountOption[]
  defaultAccount?: string
}) => {
  const normalizedValue = normalizeNonEmptyString(params.value)
  const defaultAccount = normalizeNonEmptyString(params.defaultAccount)
  const values = new Set(params.accountOptions.map(option => option.value))

  if (normalizedValue != null && values.has(normalizedValue)) {
    return normalizedValue
  }

  if (normalizedValue != null) {
    const normalizedRequestedLabel = normalizeLabel(normalizedValue)
    if (normalizedRequestedLabel != null) {
      const labelMatches = params.accountOptions.filter(option => normalizeLabel(option.label) === normalizedRequestedLabel)
      if (labelMatches.length === 1) {
        return labelMatches[0]?.value
      }
    }
  }

  if (defaultAccount != null && values.has(defaultAccount)) {
    return defaultAccount
  }

  return params.accountOptions[0]?.value
}
