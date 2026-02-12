import './SkillsTab.scss'

import { Space } from 'antd'
import { useTranslation } from 'react-i18next'

import { ActionButton } from './ActionButton'
import { EmptyState } from './EmptyState'
import { SectionHeader } from './SectionHeader'
import { TabContent } from './TabContent'

type SkillsTabProps = {
  onCreate: () => void
  onImport: () => void
}

export function SkillsTab({ onCreate, onImport }: SkillsTabProps) {
  const { t } = useTranslation()

  return (
    <TabContent className='knowledge-base-view__skills-tab'>
      <SectionHeader
        title={t('knowledge.skills.title')}
        description={t('knowledge.skills.desc')}
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
              {t('knowledge.skills.create')}
            </ActionButton>
          </Space>
        )}
      />
      <EmptyState
        description={t('knowledge.skills.empty')}
        actionLabel={t('knowledge.skills.create')}
        onAction={onCreate}
      />
    </TabContent>
  )
}
