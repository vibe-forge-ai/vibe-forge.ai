import './KnowledgeBaseHeader.scss'

import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import { ActionButton } from './ActionButton'

interface KnowledgeBaseHeaderProps {
  onRefresh: () => void
}

export function KnowledgeBaseHeader({ onRefresh }: KnowledgeBaseHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className='knowledge-base-view__header'>
      <Tooltip title={t('knowledge.actions.refresh')}>
        <ActionButton
          icon={<span className='material-symbols-rounded'>refresh</span>}
          onClick={onRefresh}
        />
      </Tooltip>
    </div>
  )
}
