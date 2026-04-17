import { Button, Popconfirm, Tooltip } from 'antd'

import type { TranslationFn } from './configUtils'

export const DetailCollectionFieldActions = ({
  index,
  itemCount,
  onMove,
  onRemove,
  t
}: {
  index: number
  itemCount: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  t: TranslationFn
}) => (
  <div className='config-view__record-actions'>
    <Tooltip title={t('config.editor.moveUp')}>
      <Button
        size='small'
        type='text'
        className='config-view__icon-button config-view__icon-button--compact'
        aria-label={t('config.editor.moveUp')}
        icon={<span className='material-symbols-rounded'>keyboard_arrow_up</span>}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      />
    </Tooltip>
    <Tooltip title={t('config.editor.moveDown')}>
      <Button
        size='small'
        type='text'
        className='config-view__icon-button config-view__icon-button--compact'
        aria-label={t('config.editor.moveDown')}
        icon={<span className='material-symbols-rounded'>keyboard_arrow_down</span>}
        disabled={index === itemCount - 1}
        onClick={() => onMove(1)}
      />
    </Tooltip>
    <Popconfirm
      title={t('config.editor.removeItemConfirmTitle')}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onConfirm={onRemove}
    >
      <Tooltip title={t('config.editor.remove')}>
        <Button
          size='small'
          type='text'
          danger
          className='config-view__icon-button config-view__icon-button--compact'
          aria-label={t('config.editor.remove')}
          icon={<span className='material-symbols-rounded'>delete</span>}
        />
      </Tooltip>
    </Popconfirm>
  </div>
)
