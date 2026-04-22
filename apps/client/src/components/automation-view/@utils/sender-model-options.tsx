import { createElement } from 'react'

import { ModelSelectOptionLabel } from '#~/components/chat/sender/@components/model-select/ModelSelectOptionLabel'
import type { ModelSelectGroupData, ModelSelectOptionData } from '#~/hooks/chat/model-selector-data'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'

interface AutomationSenderModelOptionParams {
  defaultModelLabel: string
}

const normalizeAutomationModelOption = (
  option: ModelSelectOptionData,
  params: AutomationSenderModelOptionParams
): ModelSelectOptionData => {
  if (option.value !== 'default') {
    return option
  }

  return {
    ...option,
    title: params.defaultModelLabel,
    displayLabel: params.defaultModelLabel,
    searchText: `${option.searchText} ${params.defaultModelLabel}`
  }
}

export const decorateAutomationSenderModelOption = (
  option: ModelSelectOptionData,
  params: AutomationSenderModelOptionParams
): ModelSelectOption => {
  const normalizedOption = normalizeAutomationModelOption(option, params)
  const decoratedOption: ModelSelectOption = {
    ...normalizedOption,
    canToggleRecommendation: false,
    isRecommended: false,
    isUserRecommended: false,
    label: null
  }

  decoratedOption.label = createElement(ModelSelectOptionLabel, { option: decoratedOption })
  return decoratedOption
}

export const mapAutomationSenderModelMenuGroups = (
  groups: ModelSelectGroupData[],
  params: AutomationSenderModelOptionParams
): ModelSelectMenuGroup[] => (
  groups.map(group => ({
    ...group,
    options: group.options.map(option => decorateAutomationSenderModelOption(option, params))
  }))
)
