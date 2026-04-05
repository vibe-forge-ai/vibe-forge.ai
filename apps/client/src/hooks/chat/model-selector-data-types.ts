export interface ModelSelectOptionData {
  value: string
  title: string
  description?: string
  aliases: string[]
  modelName: string
  tooltipLines: string[]
  serviceKey?: string
  serviceTitle?: string
  searchText: string
  displayLabel: string
}

export interface ModelSelectGroupData {
  key: string
  title: string
  description?: string
  options: ModelSelectOptionData[]
}

export interface ModelSelectorData {
  servicePreviewOptions: ModelSelectOptionData[]
  recommendedOptions: ModelSelectOptionData[]
  moreModelGroups: ModelSelectGroupData[]
  flatGroups: ModelSelectGroupData[]
  searchOptions: ModelSelectOptionData[]
}
