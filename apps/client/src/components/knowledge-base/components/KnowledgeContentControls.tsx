import { Button, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

interface KnowledgeContentControlsProps {
  onCreate: () => void
  onExpandSidebar: () => void
}

export function KnowledgeContentControls({
  onCreate,
  onExpandSidebar
}: KnowledgeContentControlsProps) {
  const { t } = useTranslation()

  return (
    <div className='knowledge-base-view__content-controls'>
      <Tooltip title={t('knowledge.actions.new')}>
        <Button
          className='knowledge-base-view__icon-button'
          type='primary'
          onClick={onCreate}
          icon={<span className='material-symbols-rounded'>add_circle</span>}
        />
      </Tooltip>
      <Tooltip title={t('common.expand')}>
        <Button
          className='knowledge-base-view__icon-button'
          type='text'
          onClick={onExpandSidebar}
          icon={<span className='material-symbols-rounded'>dock_to_right</span>}
        />
      </Tooltip>
    </div>
  )
}
