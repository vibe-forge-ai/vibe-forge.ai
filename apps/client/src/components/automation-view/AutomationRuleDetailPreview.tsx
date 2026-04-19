import { Button, Tooltip } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule, AutomationTask, AutomationTrigger } from '#~/api.js'
import { getServerHost, getServerPort } from '#~/api/base.js'

interface AutomationRuleDetailPreviewProps {
  rule: AutomationRule
}

const serverHost = getServerHost()
const serverPort = getServerPort()
const serverUrl = `http://${serverHost}:${serverPort}`

const getRuleTriggers = (rule: AutomationRule): AutomationTrigger[] => {
  if ((rule.triggers?.length ?? 0) > 0) return rule.triggers ?? []

  return [{
    id: rule.id,
    type: rule.type,
    intervalMs: rule.intervalMs,
    cronExpression: rule.cronExpression,
    webhookKey: rule.webhookKey
  }]
}

const getRuleTasks = (rule: AutomationRule): AutomationTask[] => {
  if ((rule.tasks?.length ?? 0) > 0) return rule.tasks ?? []

  return [{
    id: `${rule.id}:task`,
    title: rule.name,
    prompt: rule.prompt
  }]
}

const getWebhookUrl = (triggerId?: string, webhookKey?: string | null) => {
  if (!triggerId || !webhookKey) return ''
  return `${serverUrl}/api/automation/webhook/${triggerId}?key=${webhookKey}`
}

function DetailTriggerRow({ trigger }: { trigger: AutomationTrigger }) {
  const { t } = useTranslation()
  const webhookUrl = getWebhookUrl(trigger.id, trigger.webhookKey)
  const typeLabel = trigger.type === 'interval'
    ? t('automation.typeInterval')
    : trigger.type === 'cron'
    ? t('automation.typeCron')
    : t('automation.typeWebhook')

  return (
    <div className='automation-view__trigger-row automation-view__detail-trigger-row'>
      <div className='automation-view__trigger-type'>
        <span className='automation-view__detail-readonly-field automation-view__detail-readonly-field--type'>
          {typeLabel}
        </span>
      </div>
      <div className='automation-view__trigger-config'>
        {trigger.type === 'interval' && (
          <span className='automation-view__detail-readonly-field'>
            {t('automation.intervalEvery', {
              minutes: trigger.intervalMs ? Math.max(1, Math.round(trigger.intervalMs / 60000)) : 1
            })}
          </span>
        )}
        {trigger.type === 'cron' && (
          <span className='automation-view__detail-readonly-field'>
            {trigger.cronExpression?.trim() || t('automation.cronExpressionHint')}
          </span>
        )}
        {trigger.type === 'webhook' && (
          <div className='automation-view__webhook automation-view__detail-webhook'>
            <span className='automation-view__detail-readonly-field'>
              {trigger.webhookKey ?? t('automation.webhookKeyHint')}
            </span>
            {webhookUrl && (
              <div className='automation-view__webhook-row'>
                <span className='automation-view__webhook-url'>{webhookUrl}</span>
                <Tooltip title={t('automation.copy')}>
                  <Button
                    className='automation-view__icon-button'
                    type='text'
                    onClick={() => void navigator.clipboard.writeText(webhookUrl)}
                  >
                    <span className='material-symbols-rounded automation-view__action-icon'>content_copy</span>
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailTaskItem({ index, task }: { index: number; task: AutomationTask }) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const title = task.title?.trim() || t('automation.taskDefaultTitle', { index: index + 1 })

  return (
    <div className='automation-view__task-card automation-view__detail-task-card'>
      <div className={`automation-view__task-composer ${collapsed ? 'is-collapsed' : ''}`.trim()}>
        <div className='automation-view__task-title-row'>
          <Tooltip title={collapsed ? t('automation.expandTask') : t('automation.collapseTask')}>
            <Button
              aria-expanded={!collapsed}
              aria-label={collapsed ? t('automation.expandTask') : t('automation.collapseTask')}
              className='automation-view__task-collapse-button'
              type='text'
              onClick={() => setCollapsed(prev => !prev)}
            >
              <span className='material-symbols-rounded automation-view__action-icon'>
                {collapsed ? 'chevron_right' : 'keyboard_arrow_down'}
              </span>
            </Button>
          </Tooltip>
          <span
            aria-label={t('automation.taskTitle')}
            className='automation-view__detail-task-title-text'
          >
            {title}
          </span>
        </div>
        <div className='automation-view__task-collapsible' hidden={collapsed}>
          <div
            aria-label={t('automation.prompt')}
            className='automation-view__detail-task-prompt-text'
          >
            {task.prompt || t('automation.prompt')}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AutomationRuleDetailPreview({ rule }: AutomationRuleDetailPreviewProps) {
  const { t } = useTranslation()
  const triggers = getRuleTriggers(rule)
  const tasks = getRuleTasks(rule)

  return (
    <>
      <div className='automation-view__detail-section'>
        <div className='automation-view__detail-section-title'>
          <span className='material-symbols-rounded automation-view__meta-icon'>bolt</span>
          {t('automation.sectionTriggers')}
        </div>
        {triggers.length > 0
          ? (
            <div className='automation-view__trigger-rows automation-view__detail-trigger-list'>
              {triggers.map(trigger => (
                <DetailTriggerRow key={trigger.id} trigger={trigger} />
              ))}
            </div>
          )
          : <span className='automation-view__detail-placeholder'>{t('automation.noTriggers')}</span>}
      </div>
      <div className='automation-view__detail-section'>
        <div className='automation-view__detail-section-title'>
          <span className='material-symbols-rounded automation-view__meta-icon'>task</span>
          {t('automation.sectionTasks')}
        </div>
        {tasks.length > 0
          ? (
            <div className='automation-view__task-stack automation-view__detail-task-stack'>
              {tasks.map((task, index) => (
                <DetailTaskItem key={task.id} index={index} task={task} />
              ))}
            </div>
          )
          : <span className='automation-view__detail-placeholder'>{t('automation.noTasks')}</span>}
      </div>
    </>
  )
}
