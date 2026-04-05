import { Menu, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'

import { ModelSelectOptionLabel } from '../@components/model-select/ModelSelectOptionLabel'

export const useModelSelectBrowser = ({
  hasModelSearchQuery,
  modelMenuGroups,
  onToggleRecommendedModel,
  recommendedModelOptions,
  servicePreviewModelOptions,
  selectedModel,
  updatingRecommendedModelValue,
  onSelectModel
}: {
  hasModelSearchQuery: boolean
  modelMenuGroups?: ModelSelectMenuGroup[]
  onToggleRecommendedModel?: (option: ModelSelectOption) => void | Promise<void>
  recommendedModelOptions?: ModelSelectOption[]
  servicePreviewModelOptions?: ModelSelectOption[]
  selectedModel?: string
  updatingRecommendedModelValue?: string
  onSelectModel: (value: string) => void
}) => {
  const { t } = useTranslation()

  const renderCompactModelMenuLabel = useCallback((option: ModelSelectOption) => {
    return (
      <ModelSelectOptionLabel
        option={option}
        showServicePrefix
        onToggleRecommendedModel={onToggleRecommendedModel}
        updatingRecommendedModelValue={updatingRecommendedModelValue}
      />
    )
  }, [onToggleRecommendedModel, updatingRecommendedModelValue])

  const renderModelMenuGroupLabel = useCallback((group: ModelSelectMenuGroup) => {
    const label = (
      <span className='model-menu-group-label'>
        <span className='model-menu-group-title'>{group.title}</span>
      </span>
    )

    if (!group.description) {
      return label
    }

    return (
      <Tooltip
        title={group.description}
        placement='left'
        classNames={{ root: 'model-menu-tooltip' }}
        mouseEnterDelay={.35}
        destroyOnHidden
      >
        {label}
      </Tooltip>
    )
  }, [])

  const modelMenuItems = useMemo<MenuProps['items']>(() => {
    const servicePreviewItems = (servicePreviewModelOptions ?? []).map(option => ({
      key: `service-preview:${option.value}`,
      label: renderCompactModelMenuLabel(option),
      className: 'model-select-menu-item'
    }))

    const recommendedItems = (recommendedModelOptions ?? []).map(option => ({
      key: `recommended:${option.value}`,
      label: renderCompactModelMenuLabel(option),
      className: 'model-select-menu-item'
    }))

    const moreModelChildren = (modelMenuGroups ?? [])
      .filter(group => group.options.length > 0)
      .map(group => ({
        key: group.key,
        label: renderModelMenuGroupLabel(group),
        popupClassName: 'model-select-submenu-popup',
        children: group.options.map(option => ({
          key: option.value,
          label: (
            <ModelSelectOptionLabel
              option={option}
              onToggleRecommendedModel={onToggleRecommendedModel}
              updatingRecommendedModelValue={updatingRecommendedModelValue}
            />
          ),
          className: 'model-select-menu-item'
        }))
      }))

    if (moreModelChildren.length === 0) {
      if (recommendedItems.length === 0) {
        return servicePreviewItems
      }

      return [
        ...servicePreviewItems,
        {
          type: 'group',
          key: 'recommended-group',
          label: <span className='model-select-section-label'>{t('chat.modelGroupRecommended')}</span>,
          children: recommendedItems
        }
      ]
    }

    return [
      ...servicePreviewItems,
      ...(recommendedItems.length > 0
        ? [{
          type: 'group' as const,
          key: 'recommended-group',
          label: <span className='model-select-section-label'>{t('chat.modelGroupRecommended')}</span>,
          children: recommendedItems
        }]
        : []),
      {
        key: 'more-models',
        label: <span className='model-more-menu-label'>{t('chat.modelMoreModels')}</span>,
        popupClassName: 'model-select-submenu-popup',
        children: moreModelChildren
      }
    ]
  }, [
    modelMenuGroups,
    onToggleRecommendedModel,
    recommendedModelOptions,
    renderCompactModelMenuLabel,
    renderModelMenuGroupLabel,
    servicePreviewModelOptions,
    t,
    updatingRecommendedModelValue
  ])

  const handleModelMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.preventDefault()
    if (typeof key !== 'string' || key === 'more-models') {
      return
    }
    onSelectModel(key.replace(/^(service-preview:|recommended:)/, ''))
  }

  const selectedModelMenuKeys = useMemo(() => {
    if (!selectedModel) return []

    return [
      selectedModel,
      `service-preview:${selectedModel}`,
      `recommended:${selectedModel}`
    ]
  }, [selectedModel])

  const renderModelPopup = useCallback((menu: React.ReactElement) => {
    if (hasModelSearchQuery || modelMenuItems == null || modelMenuItems.length === 0) {
      return menu
    }

    return (
      <div
        className='model-select-browser'
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <Menu
          className='model-select-menu'
          mode='vertical'
          selectable
          selectedKeys={selectedModelMenuKeys}
          triggerSubMenuAction='hover'
          items={modelMenuItems}
          onClick={handleModelMenuClick}
        />
      </div>
    )
  }, [hasModelSearchQuery, handleModelMenuClick, modelMenuItems, selectedModelMenuKeys])

  return {
    renderModelPopup
  }
}
