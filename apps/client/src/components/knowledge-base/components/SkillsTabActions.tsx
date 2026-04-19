import { Segmented, Space, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ActionButton } from './ActionButton'
import { SectionHeader } from './SectionHeader'

interface SkillsTabActionsProps {
  importing: boolean
  leading?: ReactNode
  viewMode: 'project' | 'market'
  onRefresh: () => void
  onImport: () => void
  onOpenConfig: () => void
  onViewModeChange: (value: 'project' | 'market') => void
}

export function SkillsTabActions({
  importing,
  leading,
  viewMode,
  onRefresh,
  onImport,
  onOpenConfig,
  onViewModeChange
}: SkillsTabActionsProps) {
  const { t } = useTranslation()
  const isProjectView = viewMode === 'project'

  return (
    <SectionHeader
      leading={
        <div className='knowledge-base-view__skill-section-leading'>
          {leading}
          <Segmented
            className='knowledge-base-view__skill-view-switch'
            size='small'
            value={viewMode}
            onChange={(value) => onViewModeChange(value as 'project' | 'market')}
            options={[
              {
                label: (
                  <Tooltip title={t('knowledge.skills.project')}>
                    <span className='material-symbols-rounded knowledge-base-view__switch-icon'>folder_managed</span>
                  </Tooltip>
                ),
                value: 'project'
              },
              {
                label: (
                  <Tooltip title={t('knowledge.skills.market')}>
                    <span className='material-symbols-rounded knowledge-base-view__switch-icon'>storefront</span>
                  </Tooltip>
                ),
                value: 'market'
              }
            ]}
          />
        </div>
      }
      actions={
        <Space>
          <Tooltip title={t('knowledge.actions.refresh')}>
            <ActionButton
              icon={<span className='material-symbols-rounded'>refresh</span>}
              onClick={onRefresh}
            />
          </Tooltip>
          {isProjectView && (
            <Tooltip title={t('knowledge.actions.import')}>
              <ActionButton
                loading={importing}
                icon={<span className='material-symbols-rounded'>download</span>}
                onClick={onImport}
              />
            </Tooltip>
          )}
          <Tooltip title={t('knowledge.skills.openConfig')}>
            <ActionButton
              icon={<span className='material-symbols-rounded'>settings</span>}
              onClick={onOpenConfig}
            />
          </Tooltip>
        </Space>
      }
    />
  )
}
