import './KnowledgeBaseHeader.scss'

import { useTranslation } from 'react-i18next'

import { ActionButton } from './ActionButton'

interface KnowledgeBaseHeaderProps {
  onRefresh: () => void
}

export function KnowledgeBaseHeader({ onRefresh }: KnowledgeBaseHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className='knowledge-base-view__header'>
      <div className='knowledge-base-view__title'>
        <div className='knowledge-base-view__title-text'>
          {t('knowledge.title')}
        </div>
      </div>
      <ActionButton
        icon={<span className='material-symbols-rounded'>refresh</span>}
        onClick={onRefresh}
      >
        {t('knowledge.actions.refresh')}
      </ActionButton>
    </div>
  )
}
