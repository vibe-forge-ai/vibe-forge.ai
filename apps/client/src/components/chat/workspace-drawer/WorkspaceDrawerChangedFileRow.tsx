import { Tooltip } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChangedFileEntry } from './changed-files-model'
import { getFileDirectory, getFileName } from './changed-files-model'
import { getWorkspaceFileIconMeta } from './workspace-drawer-icons'

const getSubmoduleLabels = (
  entry: ChangedFileEntry,
  t: ReturnType<typeof useTranslation>['t']
) => {
  const submodule = entry.file.submodule
  if (submodule == null) {
    return []
  }

  return [
    submodule.commitChanged ? t('chat.workspaceDrawerSubmoduleCommit') : null,
    submodule.trackedChanges ? t('chat.workspaceDrawerSubmoduleTracked') : null,
    submodule.untrackedChanges ? t('chat.workspaceDrawerSubmoduleUntracked') : null
  ].filter((item): item is string => item != null)
}

export function WorkspaceDrawerChangedFileRow({
  entry,
  onOpenFile,
  selectedFilePath,
  showDirectory = true
}: {
  entry: ChangedFileEntry
  onOpenFile?: (path: string) => void
  selectedFilePath?: string | null
  showDirectory?: boolean
}) {
  const { t } = useTranslation()
  const fileName = getFileName(entry.file.path)
  const directory = getFileDirectory(entry.file.path)
  const icon = entry.file.submodule != null
    ? { icon: 'folder_special', tone: 'submodule' }
    : getWorkspaceFileIconMeta(fileName)
  const statusTooltip = useMemo(() => {
    const labels = getSubmoduleLabels(entry, t)
    const status = t(`chat.workspaceDrawerFileStatus.${entry.scope}`)
    if (labels.length === 0) {
      return status
    }
    return `${status} · ${t('chat.workspaceDrawerSubmodule')}: ${labels.join(', ')}`
  }, [entry, t])

  return (
    <button
      type='button'
      className={`chat-workspace-drawer__changed-file ${selectedFilePath === entry.file.path ? 'is-selected' : ''}`}
      title={entry.file.path}
      onClick={() => onOpenFile?.(entry.file.path)}
    >
      <span className={`material-symbols-rounded chat-workspace-drawer__changed-icon is-${icon.tone}`}>
        {icon.icon}
      </span>
      <span className='chat-workspace-drawer__changed-copy'>
        <span className='chat-workspace-drawer__changed-name'>{fileName}</span>
        {showDirectory && directory !== '' && (
          <span className='chat-workspace-drawer__changed-path'>{directory}</span>
        )}
      </span>
      <Tooltip title={statusTooltip}>
        <span
          className={`chat-workspace-drawer__changed-status-dot is-${entry.scope}`}
          aria-label={statusTooltip}
        />
      </Tooltip>
    </button>
  )
}
