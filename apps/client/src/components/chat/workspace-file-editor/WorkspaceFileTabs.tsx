import { App, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { copyTextWithFeedback } from '#~/utils/copy'

import { getWorkspaceFileIconMeta } from '../workspace-drawer/workspace-drawer-icons'

const getFileName = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path
const renderMenuIcon = (icon: string) =>
  <span className='material-symbols-rounded workspace-file-editor__menu-icon'>{icon}</span>

export function WorkspaceFileTabs({
  activePath,
  onCloseAllPaths,
  onCloseOtherPaths,
  onClosePath,
  onClosePathsToRight,
  onSelectPath,
  paths
}: {
  activePath: string
  onCloseAllPaths: () => void
  onCloseOtherPaths: (path: string) => void
  onClosePath: (path: string) => void
  onClosePathsToRight: (path: string) => void
  onSelectPath: (path: string) => void
  paths: string[]
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const activeTabRef = useRef<HTMLSpanElement | null>(null)
  const getMenuItems = useMemo(() => (path: string, index: number): MenuProps['items'] => [
    {
      key: 'copy-path',
      label: t('chat.workspaceFileCopyPath'),
      icon: renderMenuIcon('content_copy'),
      onClick: () => {
        void copyTextWithFeedback({
          failureMessage: t('common.copyFailed'),
          messageApi: message,
          successMessage: t('chat.workspaceFilePathCopied'),
          text: path
        })
      }
    },
    { type: 'divider' as const },
    {
      key: 'close',
      label: t('common.close'),
      icon: renderMenuIcon('close'),
      onClick: () => onClosePath(path)
    },
    {
      key: 'close-others',
      label: t('chat.workspaceFileCloseOthers'),
      icon: renderMenuIcon('tab_close_right'),
      disabled: paths.length <= 1,
      onClick: () => onCloseOtherPaths(path)
    },
    {
      key: 'close-right',
      label: t('chat.workspaceFileCloseRight'),
      icon: renderMenuIcon('low_priority'),
      disabled: index >= paths.length - 1,
      onClick: () => onClosePathsToRight(path)
    },
    {
      key: 'close-all',
      label: t('chat.workspaceFileCloseAll'),
      icon: renderMenuIcon('cancel_presentation'),
      onClick: onCloseAllPaths
    }
  ], [
    message,
    onCloseAllPaths,
    onCloseOtherPaths,
    onClosePath,
    onClosePathsToRight,
    paths.length,
    t
  ])

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  }, [activePath])

  return (
    <div className='workspace-file-editor__tabs' data-dock-panel-no-resize='true'>
      {paths.map((path, index) => {
        const fileName = getFileName(path)
        const icon = getWorkspaceFileIconMeta(fileName)
        return (
          <Dropdown
            key={path}
            menu={{ items: getMenuItems(path, index) }}
            overlayClassName='workspace-file-editor-context-dropdown'
            trigger={['contextMenu']}
          >
            <span
              ref={activePath === path ? activeTabRef : undefined}
              className={`workspace-file-editor__tab ${activePath === path ? 'is-active' : ''}`}
              title={path}
            >
              <span className='workspace-file-editor__tab-leading'>
                <span className={`material-symbols-rounded workspace-file-editor__tab-icon is-${icon.tone}`}>
                  {icon.icon}
                </span>
                <button
                  type='button'
                  className='workspace-file-editor__tab-close'
                  aria-label={`${t('common.close')} ${fileName}`}
                  title={`${t('common.close')} ${fileName}`}
                  onClick={() => {
                    onClosePath(path)
                  }}
                >
                  <span className='material-symbols-rounded'>close</span>
                </button>
              </span>
              <button type='button' className='workspace-file-editor__tab-main' onClick={() => onSelectPath(path)}>
                <span className='workspace-file-editor__tab-name'>{fileName}</span>
              </button>
            </span>
          </Dropdown>
        )
      })}
    </div>
  )
}
