import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChangedFilesLayout, ChangedTreeCommand } from './changed-files-model'
import type { WorkspaceTreeCommand } from './workspace-drawer-tree-types'

export type WorkspaceDrawerView = 'tree' | 'changes'

const changedLayoutItems: Array<{
  icon: string
  key: ChangedFilesLayout
  labelKey: string
}> = [
  {
    key: 'folders',
    icon: 'account_tree',
    labelKey: 'chat.workspaceDrawerChangedFolders'
  },
  {
    key: 'flat',
    icon: 'view_list',
    labelKey: 'chat.workspaceDrawerChangedFlat'
  }
]

const menuDivider = { type: 'divider' as const }
const renderMenuIcon = (icon: string) =>
  <span className='material-symbols-rounded chat-workspace-drawer__menu-icon'>{icon}</span>

export function ChatWorkspaceDrawerToolbar({
  activeView,
  changedFilesCount,
  changedLayout,
  onActiveViewChange,
  onChangedLayoutChange,
  onChangedTreeCommand,
  onForceSync,
  onWorkspaceTreeCommand
}: {
  activeView: WorkspaceDrawerView
  changedFilesCount: number
  changedLayout: ChangedFilesLayout
  onActiveViewChange: (view: WorkspaceDrawerView) => void
  onChangedLayoutChange: (layout: ChangedFilesLayout) => void
  onChangedTreeCommand: (action: ChangedTreeCommand['action']) => void
  onForceSync: () => void
  onWorkspaceTreeCommand: (action: WorkspaceTreeCommand['action']) => void
}) {
  const { t } = useTranslation()
  const viewItems = useMemo(() => [
    { key: 'tree' as const, icon: 'folder', label: t('chat.workspaceDrawerTree') },
    {
      key: 'changes' as const,
      icon: 'difference',
      label: t('chat.workspaceDrawerChangedFiles'),
      count: changedFilesCount
    }
  ], [changedFilesCount, t])

  const moreMenuItems = useMemo<MenuProps['items']>(() => [
    {
      key: 'force-sync',
      label: t('chat.workspaceDrawerForceSync'),
      icon: renderMenuIcon('sync'),
      onClick: onForceSync
    },
    ...(activeView === 'tree'
      ? [
        menuDivider,
        {
          key: 'expand-all',
          label: t('chat.workspaceDrawerExpandAll'),
          icon: renderMenuIcon('unfold_more'),
          onClick: () => onWorkspaceTreeCommand('expand')
        },
        {
          key: 'collapse-all',
          label: t('chat.workspaceDrawerCollapseAll'),
          icon: renderMenuIcon('unfold_less'),
          onClick: () => onWorkspaceTreeCommand('collapse')
        }
      ]
      : []),
    ...(activeView === 'changes'
      ? [
        menuDivider,
        {
          key: 'display-mode',
          label: t('chat.workspaceDrawerDisplayMode'),
          icon: renderMenuIcon('view_module'),
          children: changedLayoutItems.map(item => ({
            key: `layout:${item.key}`,
            label: t(item.labelKey),
            icon: renderMenuIcon(changedLayout === item.key ? 'check' : item.icon),
            onClick: () => onChangedLayoutChange(item.key)
          }))
        },
        {
          key: 'expand-all',
          label: t('chat.workspaceDrawerExpandAll'),
          icon: renderMenuIcon('unfold_more'),
          onClick: () => onChangedTreeCommand('expand')
        },
        {
          key: 'collapse-all',
          label: t('chat.workspaceDrawerCollapseAll'),
          icon: renderMenuIcon('unfold_less'),
          onClick: () => onChangedTreeCommand('collapse')
        }
      ]
      : [])
  ], [
    activeView,
    changedLayout,
    onChangedLayoutChange,
    onChangedTreeCommand,
    onForceSync,
    onWorkspaceTreeCommand,
    t
  ])

  return (
    <div className='chat-workspace-drawer__toolbar'>
      <div className='chat-workspace-drawer__view-actions'>
        {viewItems.map(item => (
          <Tooltip key={item.key} title={item.label}>
            <Button
              type='text'
              className={`chat-workspace-drawer__view-btn ${activeView === item.key ? 'is-active' : ''}`}
              aria-label={item.label}
              aria-pressed={activeView === item.key}
              onClick={() => onActiveViewChange(item.key)}
            >
              <span className='material-symbols-rounded'>{item.icon}</span>
              {item.count != null && item.count > 0 && (
                <span className='chat-workspace-drawer__view-count'>{item.count}</span>
              )}
            </Button>
          </Tooltip>
        ))}
      </div>
      <Dropdown
        menu={{ items: moreMenuItems }}
        overlayClassName='chat-workspace-drawer-more-dropdown'
        placement='bottomRight'
        trigger={['click']}
      >
        <Button
          type='text'
          className='chat-workspace-drawer__icon-btn'
          aria-label={t('common.moreActions')}
          title={t('common.moreActions')}
        >
          <span className='material-symbols-rounded'>more_vert</span>
        </Button>
      </Dropdown>
    </div>
  )
}
