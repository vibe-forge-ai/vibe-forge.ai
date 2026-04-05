import type { ModelSelectOptionData } from './model-selector-data-types'

export const sortOptionsByDisplayLabel = (options: ModelSelectOptionData[]) => {
  return [...options].sort((left, right) => {
    const labelComparison = left.displayLabel.localeCompare(right.displayLabel, undefined, {
      sensitivity: 'base'
    })
    if (labelComparison !== 0) return labelComparison

    const modelComparison = left.modelName.localeCompare(right.modelName, undefined, {
      sensitivity: 'base'
    })
    if (modelComparison !== 0) return modelComparison

    return left.value.localeCompare(right.value, undefined, {
      sensitivity: 'base'
    })
  })
}

export const buildModelSelectOption = (option: {
  value: string
  title: string
  modelName: string
  description?: string
  aliases?: string[]
  serviceKey?: string
  serviceTitle?: string
  searchTerms?: Array<string | undefined>
}): ModelSelectOptionData => {
  const description = option.description?.trim()
  const aliases = Array.from(new Set((option.aliases ?? []).filter(Boolean)))
  const tooltipLines = [
    ...aliases.filter(alias => alias !== option.title),
    option.modelName !== option.title ? option.modelName : undefined,
    description
  ].filter((item): item is string => Boolean(item))

  return {
    value: option.value,
    title: option.title,
    description,
    aliases,
    modelName: option.modelName,
    tooltipLines,
    serviceKey: option.serviceKey,
    serviceTitle: option.serviceTitle,
    searchText: [
      option.title,
      option.modelName,
      option.value,
      option.serviceTitle,
      option.serviceKey,
      description,
      ...aliases,
      ...(option.searchTerms ?? [])
    ]
      .filter(Boolean)
      .join(' '),
    displayLabel: option.title
  }
}
