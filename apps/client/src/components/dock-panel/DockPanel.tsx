import './DockPanel.scss'

import { Button } from 'antd'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_PANEL_HEIGHT = 240

const clampPanelHeight = (height: number, minHeight: number, maxHeight: number) =>
  Math.min(Math.max(height, minHeight), Math.max(minHeight, maxHeight))

const shouldIgnoreResizePointerDown = (target: HTMLElement | null) =>
  target?.closest(
    'button, a, input, textarea, select, option, [role="button"], [data-dock-panel-no-resize="true"]'
  ) != null

export function DockPanel({
  enterMotion = 'slide-up',
  allowResize = true,
  children,
  className,
  closeLabel,
  defaultHeight = DEFAULT_PANEL_HEIGHT,
  footer,
  isResizeDisabled = false,
  isOpen = true,
  maxHeight = 520,
  meta,
  minHeight = 180,
  onClose,
  resizeLabel,
  storageKey,
  title,
  actions
}: {
  enterMotion?: 'none' | 'slide-up'
  allowResize?: boolean
  actions?: ReactNode
  children: ReactNode
  className?: string
  closeLabel?: string
  defaultHeight?: number
  footer?: ReactNode
  isOpen?: boolean
  isResizeDisabled?: boolean
  maxHeight?: number
  meta?: ReactNode
  minHeight?: number
  onClose?: () => void
  resizeLabel: string
  storageKey: string
  title: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const resizeSessionRef = useRef<{ maxHeight: number; startHeight: number; startY: number } | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [panelHeight, setPanelHeight] = useState(() => {
    const storedHeight = Number(localStorage.getItem(storageKey))
    return Number.isFinite(storedHeight) && storedHeight > 0
      ? clampPanelHeight(storedHeight, minHeight, maxHeight)
      : clampPanelHeight(defaultHeight, minHeight, maxHeight)
  })
  const resizeEnabled = allowResize && !isResizeDisabled

  useEffect(() => {
    localStorage.setItem(storageKey, String(panelHeight))
  }, [panelHeight, storageKey])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  useEffect(() => {
    if (!resizeEnabled || !isResizing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const resizeSession = resizeSessionRef.current
      if (resizeSession == null) {
        return
      }

      const nextHeight = clampPanelHeight(
        resizeSession.startHeight + resizeSession.startY - event.clientY,
        minHeight,
        resizeSession.maxHeight
      )

      setPanelHeight(nextHeight)
    }

    const stopResizing = () => {
      resizeSessionRef.current = null
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }
  }, [isResizing, minHeight, resizeEnabled])

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeEnabled || shouldIgnoreResizePointerDown(event.target as HTMLElement | null)) {
      return
    }

    event.preventDefault()

    const panel = panelRef.current
    const parent = panel?.parentElement
    const parentHeight = parent?.getBoundingClientRect().height

    resizeSessionRef.current = {
      startY: event.clientY,
      startHeight: panel?.getBoundingClientRect().height ?? panelHeight,
      maxHeight: parentHeight != null ? Math.min(maxHeight, parentHeight - 96) : maxHeight
    }

    setIsResizing(true)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const panelStyle = useMemo(
    () => ({
      '--dock-panel-height': `${panelHeight}px`,
      '--dock-panel-max-height': `${maxHeight}px`,
      '--dock-panel-min-height': `${minHeight}px`
    }),
    [maxHeight, minHeight, panelHeight]
  )

  return (
    <div
      ref={panelRef}
      className={`dock-panel ${isOpen && enterMotion === 'slide-up' ? 'is-entering-slide-up' : ''} ${
        isOpen ? 'is-open' : 'is-closing'
      } ${className ?? ''} ${isResizing ? 'is-resizing' : ''} ${resizeEnabled ? 'is-resizable' : 'is-static'} ${
        isResizeDisabled ? 'is-resize-disabled' : ''
      }`}
      style={panelStyle as CSSProperties}
    >
      <div
        className={`dock-panel__resize-handle ${resizeEnabled ? 'is-resizable' : 'is-static'}`}
        title={resizeEnabled ? resizeLabel : undefined}
        onPointerDown={resizeEnabled ? handleResizePointerDown : undefined}
      >
        <div className='dock-panel__header-main'>
          <span className='dock-panel__title'>{title}</span>
          {meta != null && (
            <span className='dock-panel__meta'>{meta}</span>
          )}
        </div>
        <div className='dock-panel__header-spacer' />
        {(actions != null || onClose != null) && (
          <div className='dock-panel__header-actions'>
            {actions}
            {onClose != null && closeLabel != null && (
              <Button
                type='text'
                className='dock-panel__close-btn'
                data-dock-panel-no-resize='true'
                icon={<span className='material-symbols-rounded'>close</span>}
                title={closeLabel}
                aria-label={closeLabel}
                onClick={onClose}
              />
            )}
          </div>
        )}
      </div>

      <div className='dock-panel__body'>
        {children}
      </div>

      {footer != null && (
        <div className='dock-panel__footer'>
          {footer}
        </div>
      )}
    </div>
  )
}
