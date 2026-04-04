import '../sender-toolbar/SenderSelectShared.scss'
import './AdapterSelectControl.scss'
import './AdapterSelectDropdown.scss'

import { Select, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { SenderToolbarData, SenderToolbarHandlers, SenderToolbarState } from '../../@types/sender-toolbar-types'

export function AdapterSelectControl({
  state,
  data,
  handlers
}: {
  state: Pick<SenderToolbarState, 'adapterLocked' | 'modelUnavailable' | 'isThinking' | 'selectedAdapter'>
  data: Pick<SenderToolbarData, 'adapterOptions'>
  handlers: Pick<SenderToolbarHandlers, 'onAdapterChange'>
}) {
  const { t } = useTranslation()
  const { adapterLocked, modelUnavailable, isThinking, selectedAdapter } = state
  const { adapterOptions } = data
  const { onAdapterChange } = handlers

  if (adapterOptions == null || adapterOptions.length <= 1) {
    return null
  }

  return (
    <Tooltip title={adapterLocked ? t('chat.adapterLockedTooltip') : undefined} placement='top' arrow={false}>
      <span
        className={`adapter-select-tooltip-target ${adapterLocked ? 'adapter-select-tooltip-target--locked' : ''}`
          .trim()}
      >
        <div className='sender-select-shell sender-select-shell--adapter'>
          <Select
            className={`adapter-select ${adapterLocked ? 'adapter-select--locked' : ''}`.trim()}
            classNames={{ popup: { root: 'adapter-select-popup' } }}
            value={selectedAdapter}
            options={adapterOptions}
            showSearch={false}
            allowClear={false}
            disabled={adapterLocked || modelUnavailable || isThinking}
            onChange={(value) => onAdapterChange?.(value)}
            placeholder={t('chat.adapterSelectPlaceholder', { defaultValue: 'Adapter' })}
            optionLabelProp='label'
            popupMatchSelectWidth={false}
            suffixIcon={null}
          />
        </div>
      </span>
    </Tooltip>
  )
}
