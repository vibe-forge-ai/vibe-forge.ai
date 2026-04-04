import { Menu, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'

export const useModelSelectBrowser = ({
  hasModelSearchQuery,
  modelMenuGroups,
  recommendedModelOptions,
  selectedModel,
  onSelectModel
}: {
  hasModelSearchQuery: boolean
  modelMenuGroups?: ModelSelectMenuGroup[]
  recommendedModelOptions?: ModelSelectOption[]
  selectedModel?: string
  onSelectModel: (value: string) => void
}) => {
  const { t } = useTranslation()

  const renderModelMenuTooltip = useCallback((description?: string) => {
    if (!description) {
      return null
    }

    return <span className='model-menu-tooltip-content'>{description}</span>
  }, [])

  const renderCompactModelMenuLabel = useCallback((option: ModelSelectOption) => {
    const label = (
      <span className='model-select-menu-item-label'>
        <span className='model-select-menu-item-title'>{option.displayLabel}</span>
      </span>
    )

    if (!option.description) {
      return label
    }

    return (
      <Tooltip
        title={renderModelMenuTooltip(option.description)}
        placement='left'
        classNames={{ root: 'model-menu-tooltip' }}
        mouseEnterDelay={.35}
        destroyOnHidden
      >
        {label}
      </Tooltip>
    )
  }, [renderModelMenuTooltip])

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
        title={renderModelMenuTooltip(group.description)}
        placement='left'
        classNames={{ root: 'model-menu-tooltip' }}
        mouseEnterDelay={.35}
        destroyOnHidden
      >
        {label}
      </Tooltip>
    )
  }, [renderModelMenuTooltip])

  const modelMenuItems = useMemo<MenuProps['items']>(() => {
    const recommendedItems = (recommendedModelOptions ?? []).map(option => ({
      key: option.value,
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
          label: renderCompactModelMenuLabel(option),
          className: 'model-select-menu-item'
        }))
      }))

    if (moreModelChildren.length === 0) {
      return recommendedItems
    }

    return [
      ...recommendedItems,
      {
        key: 'more-models',
        label: <span className='model-more-menu-label'>{t('chat.modelMoreModels')}</span>,
        popupClassName: 'model-select-submenu-popup',
        children: moreModelChildren
      }
    ]
  }, [modelMenuGroups, recommendedModelOptions, renderCompactModelMenuLabel, renderModelMenuGroupLabel, t])

  const handleModelMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.preventDefault()
    if (typeof key !== 'string' || key === 'more-models') {
      return
    }
    onSelectModel(key)
  }

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
          selectedKeys={selectedModel ? [selectedModel] : []}
          triggerSubMenuAction='hover'
          items={modelMenuItems}
          onClick={handleModelMenuClick}
        />
      </div>
    )
  }, [hasModelSearchQuery, handleModelMenuClick, modelMenuItems, selectedModel])

  return {
    renderModelPopup
  }
}
