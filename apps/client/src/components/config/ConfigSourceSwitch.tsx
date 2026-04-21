import { Button, Tooltip } from 'antd'
import type { ReactNode } from 'react'

import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import type { ConfigSource } from '@vibe-forge/core'

export function ConfigSourceSwitch({
  value,
  onChange,
  options
}: {
  value: ConfigSource
  onChange: (value: ConfigSource) => void
  options: Array<{ value: ConfigSource; icon: string; label: ReactNode }>
}) {
  const { isTouchInteraction } = useResponsiveLayout()

  return (
    <div className='config-view__source-switch' role='group'>
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <Tooltip
            key={opt.value}
            title={isTouchInteraction ? undefined : opt.label}
            placement='top'
          >
            <Button
              type='text'
              size='small'
              aria-pressed={isActive}
              aria-label={String(opt.label)}
              className={`config-view__source-switch-button ${isActive ? 'is-active' : ''}`}
              icon={
                <span className='config-view__source-option' aria-hidden='true'>
                  <span className='material-symbols-rounded'>{opt.icon}</span>
                  <span className='config-view__source-option-label'>{opt.label}</span>
                </span>
              }
              onClick={() => {
                onChange(opt.value)
              }}
            />
          </Tooltip>
        )
      })}
    </div>
  )
}
