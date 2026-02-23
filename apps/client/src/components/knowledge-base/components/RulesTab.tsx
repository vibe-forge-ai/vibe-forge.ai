import './RulesTab.scss'

import { Space } from 'antd'
import { useTranslation } from 'react-i18next'

import { ActionButton } from './ActionButton'
import { EmptyState } from './EmptyState'
import { SectionHeader } from './SectionHeader'
import { TabContent } from './TabContent'

type RulesTabProps = {
  onCreate: () => void
  onImport: () => void
}

export function RulesTab({ onCreate, onImport }: RulesTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__rules-tab'>
      <SectionHeader
        title={t('knowledge.rules.title')}
        description={t('knowledge.rules.desc')}
        actions={(
          <Space>
            <ActionButton
              icon={<span className='material-symbols-rounded'>download</span>}
              onClick={onImport}
            >
              {t('knowledge.actions.import')}
            </ActionButton>
            <ActionButton
              type='primary'
              icon={<span className='material-symbols-rounded'>add_circle</span>}
              onClick={onCreate}
            >
              {t('knowledge.rules.create')}
            </ActionButton>
          </Space>
        )}
      />
      <EmptyState
        description={t('knowledge.rules.empty')}
        actionLabel={t('knowledge.rules.create')}
        onAction={onCreate}
      />
    </TabContent>
  )
}
