import { Button } from 'antd'
import type { ReactNode } from 'react'

export function DockPanelHeader({
  actions,
  closeLabel,
  fullscreenEnterLabel,
  fullscreenExitLabel,
  isFullscreen,
  meta,
  onClose,
  onToggleFullscreen,
  title
}: {
  actions?: ReactNode
  closeLabel?: string
  fullscreenEnterLabel?: string
  fullscreenExitLabel?: string
  isFullscreen: boolean
  meta?: ReactNode
  onClose?: () => void
  onToggleFullscreen?: () => void
  title: ReactNode
}) {
  const fullscreenLabel = isFullscreen ? fullscreenExitLabel : fullscreenEnterLabel

  return (
    <div className='dock-panel__header'>
      <div className='dock-panel__header-main'>
        <span className='dock-panel__title'>{title}</span>
        {meta != null && (
          <span className='dock-panel__meta'>{meta}</span>
        )}
      </div>
      <div className='dock-panel__header-spacer' />
      {(actions != null || onToggleFullscreen != null || onClose != null) && (
        <div className='dock-panel__header-actions'>
          {actions}
          {onToggleFullscreen != null && fullscreenLabel != null && (
            <Button
              type='text'
              className='dock-panel__close-btn dock-panel__fullscreen-btn'
              data-dock-panel-no-resize='true'
              icon={<span className='material-symbols-rounded'>{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>}
              title={fullscreenLabel}
              aria-label={fullscreenLabel}
              onClick={onToggleFullscreen}
            />
          )}
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
  )
}
