import './ContextFilePicker.scss'

import { Button, Modal } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ContextPickerFile } from './context-file-types'
import { toContextPickerFiles } from './context-file-types'
import { ProjectFileTree } from './project-file-tree/ProjectFileTree'
import type { ProjectFileTreeSelection } from './project-file-tree/project-file-tree-types'

export type { ContextPickerFile } from './context-file-types'

export function ContextFilePicker({
  open,
  sessionId,
  selectedPaths,
  variant = 'modal',
  onCancel,
  onConfirm
}: {
  open: boolean
  sessionId?: string
  selectedPaths: string[]
  variant?: 'inline' | 'modal'
  onCancel: () => void
  onConfirm: (files: ContextPickerFile[]) => void
}) {
  const { t } = useTranslation()
  const [checkedPaths, setCheckedPaths] = useState<string[]>(selectedPaths)
  const [selectedFiles, setSelectedFiles] = useState<ContextPickerFile[]>([])
  const selectedPathsKey = selectedPaths.join('\0')

  useEffect(() => {
    if (!open) {
      return
    }

    const nextPaths = selectedPathsKey === '' ? [] : selectedPathsKey.split('\0')
    setCheckedPaths(nextPaths)
    setSelectedFiles(toContextPickerFiles(nextPaths, []))
  }, [open, selectedPathsKey])

  const handleSelectionChange = (selection: ProjectFileTreeSelection) => {
    setCheckedPaths(selection.paths)
    setSelectedFiles(toContextPickerFiles(selection.paths, selection.nodes))
  }
  const handleConfirm = () => {
    onConfirm(toContextPickerFiles(checkedPaths, selectedFiles))
  }

  const body = (
    <div className={`context-file-picker ${variant === 'inline' ? 'context-file-picker--inline' : ''}`.trim()}>
      <div className='context-file-picker__body'>
        {open && (
          <ProjectFileTree
            selectableTypes='all'
            selectedPaths={checkedPaths}
            selectionMode='multiple'
            sessionId={sessionId}
            showLoadingState
            onSelectionChange={handleSelectionChange}
          />
        )}
      </div>
      {variant === 'inline' && (
        <div className='context-file-picker__footer'>
          <Button size='small' onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type='primary' size='small' onClick={handleConfirm}>
            {t('chat.contextPickerConfirm')}
          </Button>
        </div>
      )}
    </div>
  )

  if (variant === 'inline') {
    return body
  }

  return (
    <Modal
      open={open}
      title={t('chat.contextPickerTitle')}
      okText={t('chat.contextPickerConfirm')}
      cancelText={t('common.cancel')}
      width={640}
      onCancel={onCancel}
      onOk={handleConfirm}
      className='context-file-picker-modal'
    >
      {body}
    </Modal>
  )
}
