import './RuleFormPanel.scss'

import { Button, Form, Input, Switch, Tooltip } from 'antd'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule } from '#~/api.js'

import { TaskList } from './TaskList'
import { TriggerList } from './TriggerList'
import type { RuleFormValues } from './types'

interface RuleFormPanelProps {
  mode: 'create' | 'edit'
  rule: AutomationRule | null
  submitting: boolean
  onSubmit: (payload: Partial<AutomationRule>, immediateRun: boolean) => Promise<void>
  onCancel: () => void
}

const serverHost = (import.meta.env.__VF_PROJECT_AI_SERVER_HOST__ as string | undefined) ?? window.location.hostname
const serverPort = (import.meta.env.__VF_PROJECT_AI_SERVER_PORT__ as string | undefined) ?? '8787'
const serverUrl = `http://${serverHost}:${serverPort}`

export function RuleFormPanel({ mode, rule, submitting, onSubmit, onCancel }: RuleFormPanelProps) {
  const { t } = useTranslation()
  const [form] = Form.useForm<RuleFormValues>()

  const updateWeeklyCron = useCallback((index: number, nextDay?: string, nextTime?: string) => {
    const triggers = form.getFieldValue('triggers') as RuleFormValues['triggers'] | undefined
    const trigger = triggers?.[index]
    if (!trigger) return
    const day = nextDay ?? trigger.weeklyDay
    const time = nextTime ?? trigger.weeklyTime
    if (!day || !time) return
    const [hour, minute] = time.split(':')
    if (!hour || !minute) return
    const h = Number.parseInt(hour, 10)
    const m = Number.parseInt(minute, 10)
    if (Number.isNaN(h) || Number.isNaN(m)) return
    const expression = `${m} ${h} * * ${day}`
    const currentExpression = trigger.cronExpression
    const weeklyPattern = /^\d{1,2}\s+\d{1,2}\s+\*\s+\*\s+\d$/
    if (!currentExpression || weeklyPattern.test(currentExpression)) {
      form.setFieldValue(['triggers', index, 'cronExpression'], expression)
    }
  }, [form])

  const getWebhookUrl = useCallback((triggerId?: string, webhookKey?: string) => {
    if (!triggerId || !webhookKey) return ''
    return `${serverUrl}/api/automation/webhook/${triggerId}?key=${webhookKey}`
  }, [])

  useEffect(() => {
    if (mode === 'create') {
      form.setFieldsValue({
        name: '',
        description: '',
        enabled: true,
        immediateRun: false,
        triggers: [
          {
            type: 'interval',
            intervalMinutes: 30,
            cronExpression: '',
            cronPreset: undefined,
            weeklyDay: '1',
            weeklyTime: '09:00'
          }
        ],
        tasks: [
          {
            title: t('automation.taskDefaultTitle', { index: 1 }),
            prompt: ''
          }
        ]
      })
      return
    }
    if (mode === 'edit' && rule) {
      const triggers = (rule.triggers ?? []).map(trigger => {
        const cronExpression = trigger.cronExpression ?? ''
        const weeklyMatch = cronExpression.match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\d)$/)
        return {
          id: trigger.id,
          type: trigger.type,
          intervalMinutes: trigger.intervalMs ? Math.max(1, Math.round(trigger.intervalMs / 60000)) : undefined,
          webhookKey: trigger.webhookKey ?? undefined,
          cronExpression,
          cronPreset: undefined,
          weeklyDay: weeklyMatch ? weeklyMatch[3] : '1',
          weeklyTime: weeklyMatch ? `${weeklyMatch[2].padStart(2, '0')}:${weeklyMatch[1].padStart(2, '0')}` : '09:00'
        }
      })
      const tasks = (rule.tasks ?? []).map((task, index) => ({
        id: task.id,
        title: task.title || t('automation.taskDefaultTitle', { index: index + 1 }),
        prompt: task.prompt
      }))
      form.setFieldsValue({
        name: rule.name,
        description: rule.description ?? '',
        enabled: rule.enabled,
        immediateRun: false,
        triggers: triggers.length > 0 ? triggers : [{
          type: 'interval',
          intervalMinutes: 30,
          cronExpression: '',
          cronPreset: undefined,
          weeklyDay: '1',
          weeklyTime: '09:00'
        }],
        tasks: tasks.length > 0 ? tasks : [{
          title: t('automation.taskDefaultTitle', { index: 1 }),
          prompt: ''
        }]
      })
    }
  }, [form, mode, rule, t])

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields()
    const payload: Partial<AutomationRule> = {
      name: values.name.trim(),
      description: values.description?.trim() ?? '',
      enabled: values.enabled,
      triggers: values.triggers.map((trigger) => {
        if (trigger.type === 'interval') {
          return {
            id: trigger.id,
            type: 'interval',
            intervalMs: Math.max(1, trigger.intervalMinutes ?? 1) * 60000
          }
        }
        if (trigger.type === 'cron') {
          return {
            id: trigger.id,
            type: 'cron',
            cronExpression: trigger.cronExpression?.trim() ?? ''
          }
        }
        return {
          id: trigger.id,
          type: 'webhook',
          webhookKey: trigger.webhookKey?.trim() ?? ''
        }
      }) as AutomationRule['triggers'],
      tasks: values.tasks.map((task) => ({
        id: task.id,
        title: task.title?.trim() ?? '',
        prompt: task.prompt.trim()
      })) as AutomationRule['tasks']
    }
    await onSubmit(payload, values.immediateRun)
  }, [form, onSubmit])

  return (
    <div className='automation-view__form-panel'>
      <div className='automation-view__form-header'>
        <div className='automation-view__form-title'>
          <span className='material-symbols-rounded automation-view__form-icon'>edit_square</span>
          {mode === 'create' ? t('automation.newRule') : t('automation.editRule')}
        </div>
        <div className='automation-view__form-header-actions'>
          <Tooltip title={t('common.cancel')}>
            <Button
              className='automation-view__square-button'
              onClick={onCancel}
            >
              {t('common.cancel')}
            </Button>
          </Tooltip>
          <Tooltip title={t('common.confirm')}>
            <Button
              className='automation-view__square-button automation-view__square-button--confirm'
              type='primary'
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              {t('common.confirm')}
            </Button>
          </Tooltip>
        </div>
      </div>
      <Form form={form} layout='vertical' initialValues={{ enabled: true, immediateRun: false }}>
        <div className='automation-view__form-grid'>
          <div className='automation-view__form-left'>
            <div className='automation-view__form-section'>
              <div className='automation-view__form-title'>
                <span className='material-symbols-rounded automation-view__form-icon'>info</span>
                {t('automation.sectionBasic')}
              </div>
              <div className='automation-view__form-desc'>{t('automation.basicDesc')}</div>
              <Form.Item
                name='name'
                label={(
                  <span className='automation-view__label'>
                    <span className='material-symbols-rounded automation-view__label-icon'>badge</span>
                    {t('automation.ruleName')}
                  </span>
                )}
                rules={[{ required: true, message: t('automation.ruleNameRequired') }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='description'
                label={(
                  <span className='automation-view__label'>
                    <span className='material-symbols-rounded automation-view__label-icon'>description</span>
                    {t('automation.ruleDescription')}
                  </span>
                )}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
              <div className='automation-view__toggle-group'>
                <div className='automation-view__toggle-row'>
                  <span className='automation-view__toggle-label'>
                    <span className='material-symbols-rounded automation-view__label-icon'>toggle_on</span>
                    {t('automation.enabled')}
                  </span>
                  <Form.Item name='enabled' valuePropName='checked' noStyle>
                    <Switch />
                  </Form.Item>
                </div>
                <div className='automation-view__toggle-row'>
                  <span className='automation-view__toggle-label automation-view__toggle-label--run'>
                    <span className='material-symbols-rounded automation-view__label-icon automation-view__label-icon--run'>play_circle</span>
                    {t('automation.immediateRun')}
                  </span>
                  <Form.Item name='immediateRun' valuePropName='checked' noStyle>
                    <Switch />
                  </Form.Item>
                </div>
              </div>
            </div>
          </div>
          <div className='automation-view__form-right'>
            <div className='automation-view__form-right-scroll'>
              <div className='automation-view__form-section'>
                <TriggerList
                  form={form}
                  updateWeeklyCron={updateWeeklyCron}
                  getWebhookUrl={getWebhookUrl}
                />
              </div>

              <div className='automation-view__form-section'>
                <TaskList />
              </div>
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}
