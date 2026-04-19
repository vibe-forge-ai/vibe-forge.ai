import { Button, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

interface AutomationPanelTitleActionsProps {
  collapsed: boolean
  defaultIcon?: string
  defaultIconClassName?: string
  isCreating: boolean
  onCreateRule?: () => void
  onExpandRulePanel?: () => void
}

export function AutomationPanelTitleActions({
  collapsed,
  defaultIcon,
  defaultIconClassName,
  isCreating,
  onCreateRule,
  onExpandRulePanel
}: AutomationPanelTitleActionsProps) {
  const { t } = useTranslation()

  if (!collapsed) {
    if (!defaultIcon) return null
    return (
      <span className={`material-symbols-rounded ${defaultIconClassName ?? ''}`.trim()}>
        {defaultIcon}
      </span>
    )
  }

  return (
    <span className='automation-view__title-leading-actions'>
      <Tooltip title={t('automation.expandRulePanel')}>
        <Button
          className='automation-view__title-action-button automation-view__title-action-button--expand'
          type='text'
          aria-label={t('automation.expandRulePanel')}
          icon={<span className='material-symbols-rounded automation-view__title-action-icon'>dock_to_right</span>}
          onClick={onExpandRulePanel}
        />
      </Tooltip>
      <Tooltip title={isCreating ? t('automation.creatingRule') : t('automation.newRule')}>
        <Button
          className={[
            'automation-view__title-action-button',
            'automation-view__title-action-button--create',
            isCreating ? 'is-active' : ''
          ].filter(Boolean).join(' ')}
          type='text'
          aria-label={isCreating ? t('automation.creatingRule') : t('automation.newRule')}
          disabled={isCreating}
          icon={
            <span
              className={`material-symbols-rounded automation-view__title-action-icon ${isCreating ? 'filled' : ''}`
                .trim()}
            >
              {isCreating ? 'progress_activity' : 'add'}
            </span>
          }
          onClick={onCreateRule}
        />
      </Tooltip>
    </span>
  )
}
