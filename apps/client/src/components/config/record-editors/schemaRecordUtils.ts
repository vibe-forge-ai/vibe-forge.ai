import type { ConfigUiObjectSchema, ConfigUiRecordMapSchema } from '@vibe-forge/types'

import { getValueByPath, setValueByPath } from '../configUtils'

export const toLabel = (value: string) => (
  value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase())
)

export const buildConfigUiObjectDefaultValue = (schema: ConfigUiObjectSchema | undefined) => {
  const initial: Record<string, unknown> = {}
  for (const field of schema?.fields ?? []) {
    if (field.defaultValue === undefined) continue
    const nextValue = typeof field.defaultValue === 'object' && field.defaultValue != null
      ? JSON.parse(JSON.stringify(field.defaultValue))
      : field.defaultValue
    Object.assign(initial, setValueByPath(initial, field.path, nextValue))
  }
  return initial
}

export const resolveConfigUiRecordEntry = ({
  schema,
  entryKey,
  entryValue
}: {
  schema: ConfigUiRecordMapSchema
  entryKey: string
  entryValue: Record<string, unknown>
}) => {
  if (schema.mode === 'keyed') {
    const matchedSchema = schema.schemas[entryKey]
    return {
      itemSchema: matchedSchema ?? schema.unknownSchema,
      isKnownEntry: matchedSchema != null
    }
  }

  const discriminatorField = schema.discriminatorField ?? 'type'
  const discriminatorValue = getValueByPath(entryValue, [discriminatorField])
  if (typeof discriminatorValue === 'string') {
    const matchedSchema = schema.schemas[discriminatorValue]
    return {
      itemSchema: matchedSchema ?? schema.unknownSchema,
      isKnownEntry: matchedSchema != null
    }
  }

  return {
    itemSchema: schema.unknownSchema,
    isKnownEntry: false
  }
}
