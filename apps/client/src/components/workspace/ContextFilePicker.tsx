import './ContextFilePicker.scss'

import { App, Button, Empty, Modal, Spin, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { listWorkspaceTree } from '#~/api/workspace'

export interface ContextPickerFile {
  path: string
  name?: string
}

interface ContextFileTreeNode extends DataNode {
  key: string
  path: string
  title: string
  children?: ContextFileTreeNode[]
  isLeaf?: boolean
  disableCheckbox?: boolean
}

const replaceNodeChildren = (
  nodes: ContextFileTreeNode[],
  targetPath: string,
  children: ContextFileTreeNode[]
): ContextFileTreeNode[] => {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return {
        ...node,
        children
      }
    }
    if (node.children == null) {
      return node
    }
    return {
      ...node,
      children: replaceNodeChildren(node.children, targetPath, children)
    }
  })
}

const toTreeNodes = (entries: Awaited<ReturnType<typeof listWorkspaceTree>>['entries']): ContextFileTreeNode[] =>
  entries.map(entry => ({
    key: entry.path,
    path: entry.path,
    title: entry.name,
    isLeaf: entry.type === 'file',
    disableCheckbox: entry.type !== 'file'
  }))

const toPendingFiles = (paths: string[]): ContextPickerFile[] =>
  paths.map(path => ({
    path,
    name: path.split('/').pop() ?? path
  }))

export function ContextFilePicker({
  open,
  selectedPaths,
  variant = 'modal',
  onCancel,
  onConfirm
}: {
  open: boolean
  selectedPaths: string[]
  variant?: 'inline' | 'modal'
  onCancel: () => void
  onConfirm: (files: ContextPickerFile[]) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [checkedKeys, setCheckedKeys] = useState<string[]>(selectedPaths)
  const [treeData, setTreeData] = useState<ContextFileTreeNode[]>([])
  const [loadingRoot, setLoadingRoot] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setCheckedKeys(selectedPaths)
    setLoadingRoot(true)
    void listWorkspaceTree()
      .then((result) => {
        setTreeData(toTreeNodes(result.entries))
      })
      .catch(() => {
        void message.error(t('chat.contextPickerLoadFailed'))
      })
      .finally(() => {
        setLoadingRoot(false)
      })
  }, [message, open, selectedPaths, t])

  const loadData = async (node: DataNode) => {
    const path = String(node.key)
    const result = await listWorkspaceTree(path)
    setTreeData(prev => replaceNodeChildren(prev, path, toTreeNodes(result.entries)))
  }

  const body = (
    <div className={`context-file-picker ${variant === 'inline' ? 'context-file-picker--inline' : ''}`.trim()}>
      <div className='context-file-picker__body'>
        {loadingRoot
          ? (
            <div className='context-file-picker__loading'>
              <Spin size='small' />
              <span>{t('chat.contextPickerLoading')}</span>
            </div>
          )
          : treeData.length === 0
          ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('chat.contextPickerEmpty')}
            />
          )
          : (
            <Tree
              blockNode
              checkable
              checkStrictly
              treeData={treeData}
              checkedKeys={checkedKeys}
              loadData={loadData}
              switcherIcon={
                <span className='material-symbols-rounded context-file-picker__switcher'>chevron_right</span>
              }
              onCheck={(keys) => {
                const nextKeys = Array.isArray(keys) ? keys : keys.checked
                setCheckedKeys(nextKeys.map(String))
              }}
            />
          )}
      </div>
      {variant === 'inline' && (
        <div className='context-file-picker__footer'>
          <Button size='small' onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type='primary' size='small' onClick={() => onConfirm(toPendingFiles(checkedKeys))}>
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
      onOk={() => onConfirm(toPendingFiles(checkedKeys))}
      className='context-file-picker-modal'
    >
      {body}
    </Modal>
  )
}
