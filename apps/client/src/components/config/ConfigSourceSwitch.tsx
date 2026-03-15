import { Radio } from 'antd'
import type { ReactNode } from 'react'

import type { ConfigSource } from '@vibe-forge/core'

export function ConfigSourceSwitch({
  value,
  onChange,
  options,
}: {
  value: ConfigSource
  onChange: (value: ConfigSource) => void
  options: Array<{ value: ConfigSource; icon: string; label: ReactNode }>
}) {
  return (
    <Radio.Group
      value={value}
      optionType='button'
      buttonStyle='solid'
      size='small'
      onChange={(event) => {
        onChange(event.target.value as ConfigSource)
      }}
      options={options.map(opt => ({
        value: opt.value,
        label: (
          <span className='config-view__source-option'>
            <span className='material-symbols-rounded'>{opt.icon}</span>
            <span>{opt.label}</span>
          </span>
        )
      }))}
    />
  )
}
