import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getWorkspaceFileIconMeta } from '../workspace-drawer/workspace-drawer-icons'

const getFileName = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

export function WorkspaceFileTabs({
  activePath,
  onClosePath,
  onSelectPath,
  paths
}: {
  activePath: string
  onClosePath: (path: string) => void
  onSelectPath: (path: string) => void
  paths: string[]
}) {
  const { t } = useTranslation()
  const activeTabRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  }, [activePath])

  return (
    <div className='workspace-file-editor__tabs' data-dock-panel-no-resize='true'>
      {paths.map((path) => {
        const fileName = getFileName(path)
        const icon = getWorkspaceFileIconMeta(fileName)
        return (
          <span
            key={path}
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
        )
      })}
    </div>
  )
}
