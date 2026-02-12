import './KnowledgeBaseHeader.scss'

import { useTranslation } from 'react-i18next'

import { ActionButton } from './ActionButton'

type KnowledgeBaseHeaderProps = {
  onRefresh: () => void
}

export function KnowledgeBaseHeader({ onRefresh }: KnowledgeBaseHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className='knowledge-base-view__header'>
      <div className='knowledge-base-view__title'>
        <span className='material-symbols-rounded knowledge-base-view__title-icon'>library_books</span>
        <div className='knowledge-base-view__title-text'>
          <div className='knowledge-base-view__title-main'>{t('knowledge.title')}</div>
          <div className='knowledge-base-view__subtitle'>{t('knowledge.subtitle')}</div>
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
