import { Radio } from 'antd'

import type { ConfigSource } from '@vibe-forge/core'

import type { TranslationFn } from './configUtils'

export function ConfigSourceSwitch({
  value,
  onChange,
  configPresent,
  t
}: {
  value: ConfigSource
  onChange: (value: ConfigSource) => void
  configPresent?: { project?: boolean; user?: boolean }
  t: TranslationFn
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
      options={[
        {
          label: (
            <span className='config-view__source-option'>
              <span className='material-symbols-rounded'>folder</span>
              <span>
                {configPresent?.project === true
                  ? t('config.sources.project')
                  : t('config.sources.projectMissing')}
              </span>
            </span>
          ),
          value: 'project'
        },
        {
          label: (
            <span className='config-view__source-option'>
              <span className='material-symbols-rounded'>person</span>
              <span>
                {configPresent?.user === true
                  ? t('config.sources.user')
                  : t('config.sources.userMissing')}
              </span>
            </span>
          ),
          value: 'user'
        }
      ]}
    />
  )
}
