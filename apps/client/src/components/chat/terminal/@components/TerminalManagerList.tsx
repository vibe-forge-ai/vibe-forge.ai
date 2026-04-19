import { Button, Tooltip } from 'antd'
import type { DragEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTerminalTitleEditor } from '../@hooks/use-terminal-title-editor'
import type { MoveTerminalPanePlacement, TerminalPaneConfig } from '../@utils/terminal-panes'

export interface TerminalPaneInfo {
  shellLabel: string
  isExited: boolean
}

interface DropTargetState {
  terminalId: string
  placement: MoveTerminalPanePlacement
}

export function TerminalManagerList({
  activeTerminalId,
  infoById,
  panes,
  onActivate,
  onClose,
  onMove,
  onRename
}: {
  activeTerminalId: string
  infoById: Record<string, TerminalPaneInfo>
  panes: TerminalPaneConfig[]
  onActivate: (terminalId: string) => void
  onClose: (terminalId: string) => void
  onMove: (sourceId: string, targetId: string, placement: MoveTerminalPanePlacement) => void
  onRename: (terminalId: string, title: string) => void
}) {
  const { t } = useTranslation()
  const [draggingTerminalId, setDraggingTerminalId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null)
  const {
    cancelEditing,
    editingInputRef,
    editingTerminalId,
    editingTitle,
    finishEditing,
    setEditingTitle,
    startEditing
  } = useTerminalTitleEditor({ onActivate, onRename, panes })

  const handleDragStart = (event: DragEvent, terminalId: string) => {
    setDraggingTerminalId(terminalId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', terminalId)

    const dragImage = event.currentTarget.closest('.chat-terminal-view__manager-item')
    if (dragImage instanceof HTMLElement) {
      event.dataTransfer.setDragImage(dragImage, 12, 14)
    }
  }

  const handleDragOver = (event: DragEvent, terminalId: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (draggingTerminalId === terminalId) {
      setDropTarget(null)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropTarget(current => (
      current?.terminalId === terminalId && current.placement === placement
        ? current
        : { terminalId, placement }
    ))
  }

  const handleDrop = (event: DragEvent, targetId: string) => {
    event.preventDefault()
    const sourceId = draggingTerminalId ?? event.dataTransfer.getData('text/plain')
    const placement = dropTarget?.terminalId === targetId ? dropTarget.placement : 'before'
    setDraggingTerminalId(null)
    setDropTarget(null)
    if (sourceId !== '' && sourceId !== targetId) {
      onMove(sourceId, targetId, placement)
    }
  }

  return (
    <aside
      className='chat-terminal-view__manager'
      aria-label={t('chat.terminal.manageTerminals')}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setDropTarget(null)
        }
      }}
    >
      {panes.map((pane) => {
        const info = infoById[pane.id]
        const isEditing = pane.id === editingTerminalId
        const shellLabel = info?.shellLabel ?? t(`chat.terminal.shell.${pane.shellKind}`)
        const shellTooltip = info?.isExited === true
          ? t('chat.terminal.shellTooltipExited', { shell: shellLabel })
          : t('chat.terminal.shellTooltip', { shell: shellLabel })
        return (
          <div
            key={pane.id}
            className={`chat-terminal-view__manager-item ${pane.id === activeTerminalId ? 'is-active' : ''} ${
              pane.id === draggingTerminalId ? 'is-dragging' : ''
            } ${isEditing ? 'is-editing' : ''} ${
              dropTarget?.terminalId === pane.id ? `is-drop-${dropTarget.placement}` : ''
            }`}
            onClick={() => onActivate(pane.id)}
            onDragOver={(event) => handleDragOver(event, pane.id)}
            onDrop={(event) => handleDrop(event, pane.id)}
          >
            <button
              type='button'
              className='chat-terminal-view__manager-drag material-symbols-rounded'
              draggable
              title={t('chat.terminal.dragSession')}
              aria-label={t('chat.terminal.dragSession')}
              onDragStart={(event) => handleDragStart(event, pane.id)}
              onDragEnd={() => {
                setDraggingTerminalId(null)
                setDropTarget(null)
              }}
            >
              drag_indicator
            </button>
            <Tooltip title={isEditing ? null : shellTooltip} placement='top'>
              <span className='chat-terminal-view__manager-title-wrap'>
                {isEditing
                  ? (
                    <>
                      <span className='chat-terminal-view__manager-edit-icon material-symbols-rounded'>
                        edit
                      </span>
                      <input
                        ref={editingInputRef}
                        className='chat-terminal-view__manager-title-input'
                        value={editingTitle}
                        aria-label={t('chat.terminal.renameSession', { title: pane.title })}
                        onBlur={finishEditing}
                        onChange={event => setEditingTitle(event.target.value)}
                        onClick={event => event.stopPropagation()}
                        onDoubleClick={event => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            finishEditing()
                            return
                          }

                          if (event.key === 'Escape') {
                            cancelEditing()
                          }
                        }}
                      />
                    </>
                  )
                  : (
                    <span
                      className='chat-terminal-view__manager-title-text'
                      onDoubleClick={(event) => {
                        event.stopPropagation()
                        startEditing(pane)
                      }}
                    >
                      {pane.title}
                    </span>
                  )}
              </span>
            </Tooltip>
            <Button
              type='text'
              className='chat-terminal-view__manager-close'
              data-dock-panel-no-resize='true'
              icon={<span className='material-symbols-rounded'>close</span>}
              title={t('chat.terminal.closeNamedSession', { title: pane.title })}
              aria-label={t('chat.terminal.closeNamedSession', { title: pane.title })}
              onClick={(event) => {
                event.stopPropagation()
                onClose(pane.id)
              }}
            />
          </div>
        )
      })}
    </aside>
  )
}
