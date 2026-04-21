import '@xterm/xterm/css/xterm.css'
import './ChatTerminalView.scss'

import type { TFunction } from 'i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TerminalShellKind } from '@vibe-forge/types'

import { DockPanel } from '#~/components/dock-panel/DockPanel'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import {
  CHAT_BOTTOM_DOCK_DEFAULT_HEIGHT,
  CHAT_BOTTOM_DOCK_HEIGHT_STORAGE_KEY,
  CHAT_BOTTOM_DOCK_MAX_HEIGHT,
  CHAT_BOTTOM_DOCK_MIN_HEIGHT
} from '../bottom-dock-constants'
import { TerminalManagerList } from './@components/TerminalManagerList'
import type { TerminalPaneInfo } from './@components/TerminalManagerList'
import { TerminalPane } from './@components/TerminalPane'
import { TerminalPanelActions } from './@components/TerminalPanelActions'
import {
  DEFAULT_TERMINAL_ID,
  createTerminalPane,
  getNextTerminalTitle,
  moveTerminalPane,
  normalizeTerminalPanes,
  withFixedTerminalTitles
} from './@utils/terminal-panes'
import type { MoveTerminalPanePlacement } from './@utils/terminal-panes'

const buildTerminalPaneStorageKey = (sessionId: string) => `chatTerminalPaneIds:${sessionId}`

const readTerminalPanes = (sessionId: string, t: TFunction) => {
  const raw = localStorage.getItem(buildTerminalPaneStorageKey(sessionId))
  if (raw == null || raw === '') {
    return withFixedTerminalTitles(normalizeTerminalPanes(null), t)
  }

  try {
    return withFixedTerminalTitles(normalizeTerminalPanes(JSON.parse(raw) as unknown), t)
  } catch {
    return withFixedTerminalTitles(normalizeTerminalPanes(null), t)
  }
}

export function ChatTerminalView({
  isOpen,
  onClose,
  sessionId
}: {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}) {
  const { t } = useTranslation()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const [panes, setPanes] = useState(() => readTerminalPanes(sessionId, t))
  const [activeTerminalId, setActiveTerminalId] = useState(() =>
    readTerminalPanes(sessionId, t)[0]?.id ?? DEFAULT_TERMINAL_ID
  )
  const [terminalInfoById, setTerminalInfoById] = useState<Record<string, TerminalPaneInfo>>({})
  const [isManagerVisible, setIsManagerVisible] = useState(true)
  const terminateHandlersRef = useRef(new Map<string, () => boolean>())

  useEffect(() => {
    const nextPanes = readTerminalPanes(sessionId, t)
    setPanes(nextPanes)
    setActiveTerminalId(nextPanes[0]?.id ?? DEFAULT_TERMINAL_ID)
    setTerminalInfoById({})
    setIsManagerVisible(true)
  }, [sessionId, t])

  useEffect(() => {
    localStorage.setItem(buildTerminalPaneStorageKey(sessionId), JSON.stringify(panes))
  }, [panes, sessionId])

  const handleAddTerminal = useCallback((shellKind: TerminalShellKind = 'default') => {
    const pane = createTerminalPane(shellKind, getNextTerminalTitle(panes, t))
    setPanes(current => [...current, pane])
    setActiveTerminalId(pane.id)
  }, [panes, t])

  const handleCloseTerminal = useCallback((terminalId: string) => {
    void terminateHandlersRef.current.get(terminalId)?.()
    setTerminalInfoById((current) => {
      const next = { ...current }
      delete next[terminalId]
      return next
    })
    setPanes((current) => {
      if (current.length <= 1) {
        return current
      }

      const removedIndex = current.findIndex(item => item.id === terminalId)
      const nextPanes = current.filter(item => item.id !== terminalId)
      setActiveTerminalId((activeId) => {
        if (activeId !== terminalId) {
          return activeId
        }

        return nextPanes[Math.min(Math.max(removedIndex, 0), nextPanes.length - 1)]?.id ?? DEFAULT_TERMINAL_ID
      })
      return nextPanes
    })
  }, [])

  const handleTerminalInfoChange = useCallback((terminalId: string, info: TerminalPaneInfo) => {
    setTerminalInfoById(current => ({ ...current, [terminalId]: info }))
  }, [])

  const handleTerminateChange = useCallback((terminalId: string, handler: (() => boolean) | null) => {
    if (handler == null) {
      terminateHandlersRef.current.delete(terminalId)
      return
    }

    terminateHandlersRef.current.set(terminalId, handler)
  }, [])

  const handleRenameTerminal = useCallback((terminalId: string, title: string) => {
    setPanes(current => current.map(item => item.id === terminalId ? { ...item, title } : item))
  }, [])

  const handleMoveTerminal = useCallback((
    sourceId: string,
    targetId: string,
    placement: MoveTerminalPanePlacement
  ) => {
    setPanes(current => moveTerminalPane(current, sourceId, targetId, placement))
  }, [])

  const shouldShowManagerToggle = panes.length > 1
  const isCompactView = isCompactLayout || isTouchInteraction

  return (
    <DockPanel
      allowFullscreen={!isCompactView}
      allowResize={!isCompactView}
      className='chat-terminal-view'
      defaultHeight={isCompactView ? 208 : CHAT_BOTTOM_DOCK_DEFAULT_HEIGHT}
      fullscreenEnterLabel={t('common.enterFullscreen')}
      fullscreenExitLabel={t('common.exitFullscreen')}
      isOpen={isOpen}
      maxHeight={isCompactView ? 320 : CHAT_BOTTOM_DOCK_MAX_HEIGHT}
      minHeight={isCompactView ? 180 : CHAT_BOTTOM_DOCK_MIN_HEIGHT}
      title={t('chat.viewTerminal')}
      closeLabel={t('common.close')}
      resizeLabel={t('chat.terminal.resizePanel')}
      storageKey={CHAT_BOTTOM_DOCK_HEIGHT_STORAGE_KEY}
      onClose={onClose}
      actions={
        <TerminalPanelActions
          isManagerToggleVisible={shouldShowManagerToggle}
          isManagerVisible={isManagerVisible}
          terminalCount={panes.length}
          onAddTerminal={handleAddTerminal}
          onToggleManager={() => setIsManagerVisible(current => !current)}
        />
      }
    >
      <div className='chat-terminal-view__surface'>
        <div className='chat-terminal-view__terminal-stage'>
          {panes.map(pane => (
            <TerminalPane
              key={pane.id}
              isActive={pane.id === activeTerminalId}
              sessionId={sessionId}
              shellKind={pane.shellKind}
              terminalId={pane.id}
              onInfoChange={handleTerminalInfoChange}
              onTerminateChange={handleTerminateChange}
            />
          ))}
        </div>
        {shouldShowManagerToggle && isManagerVisible && (
          <TerminalManagerList
            activeTerminalId={activeTerminalId}
            infoById={terminalInfoById}
            panes={panes}
            onActivate={setActiveTerminalId}
            onClose={handleCloseTerminal}
            onMove={handleMoveTerminal}
            onRename={handleRenameTerminal}
          />
        )}
      </div>
    </DockPanel>
  )
}
