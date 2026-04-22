import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProjectFileTreeCommand } from '#~/components/workspace/project-file-tree/project-file-tree-types'

import type { ChangedFilesLayout, ChangedTreeCommand } from './changed-files-model'

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
  onWorkspaceTreeCommand,
  selectedFilePath
}: {
  activeView: WorkspaceDrawerView
  changedFilesCount: number
  changedLayout: ChangedFilesLayout
  onActiveViewChange: (view: WorkspaceDrawerView) => void
  onChangedLayoutChange: (layout: ChangedFilesLayout) => void
  onChangedTreeCommand: (action: ChangedTreeCommand['action']) => void
  onForceSync: () => void
  onWorkspaceTreeCommand: (action: ProjectFileTreeCommand['action'], path?: string) => void
  selectedFilePath?: string | null
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
        }
      ]
      : [])
  ], [
    activeView,
    changedLayout,
    onChangedLayoutChange,
    onForceSync,
    t
  ])
  const hasSelectedFile = selectedFilePath != null && selectedFilePath !== ''
  const handleExpandAll = () => {
    if (activeView === 'tree') {
      onWorkspaceTreeCommand('expand')
      return
    }
    onChangedTreeCommand('expand')
  }
  const handleCollapseAll = () => {
    if (activeView === 'tree') {
      onWorkspaceTreeCommand('collapse')
      return
    }
    onChangedTreeCommand('collapse')
  }

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
      <div className='chat-workspace-drawer__toolbar-actions'>
        <Tooltip title={t('chat.workspaceDrawerLocateFile')}>
          <span className='chat-workspace-drawer__toolbar-button-wrap'>
            <Button
              type='text'
              className='chat-workspace-drawer__icon-btn'
              aria-label={t('chat.workspaceDrawerLocateFile')}
              disabled={!hasSelectedFile}
              onClick={() => onWorkspaceTreeCommand('locate', selectedFilePath ?? undefined)}
            >
              <span className='material-symbols-rounded'>my_location</span>
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={t('chat.workspaceDrawerExpandAll')}>
          <Button
            type='text'
            className='chat-workspace-drawer__icon-btn'
            aria-label={t('chat.workspaceDrawerExpandAll')}
            onClick={handleExpandAll}
          >
            <span className='material-symbols-rounded'>unfold_more</span>
          </Button>
        </Tooltip>
        <Tooltip title={t('chat.workspaceDrawerCollapseAll')}>
          <Button
            type='text'
            className='chat-workspace-drawer__icon-btn'
            aria-label={t('chat.workspaceDrawerCollapseAll')}
            onClick={handleCollapseAll}
          >
            <span className='material-symbols-rounded'>unfold_less</span>
          </Button>
        </Tooltip>
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
    </div>
  )
}
