import './RuleFormPanel.scss'

import { Button, Form, Input, Switch, Tooltip } from 'antd'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule } from '#~/api.js'
import { getServerHost, getServerPort } from '#~/api/base.js'

import { DEFAULT_SELECT_VALUE, DEFAULT_STARTUP_FORM_VALUES } from './@utils/startup-options'
import { AutomationPanelTitleActions } from './PanelTitleActions'
import { TaskList } from './TaskList'
import { TriggerList } from './TriggerList'
import type { RuleFormValues } from './types'

interface RuleFormPanelProps {
  isRulePanelCollapsed?: boolean
  mode: 'create' | 'edit'
  rule: AutomationRule | null
  submitting: boolean
  onCreateRule?: () => void
  onExpandRulePanel?: () => void
  onSubmit: (payload: Partial<AutomationRule>, immediateRun: boolean) => Promise<void>
  onCancel: () => void
}

const serverHost = getServerHost()
const serverPort = getServerPort()
const serverUrl = `http://${serverHost}:${serverPort}`

const normalizeSelectText = (value?: string) => {
  const normalized = value?.trim()
  return normalized == null || normalized === '' ? null : normalized
}

const getCreateWorktreeMode = (
  task: NonNullable<AutomationRule['tasks']>[number]
): NonNullable<RuleFormValues['tasks'][number]['createWorktreeMode']> => {
  if (task.createWorktree === true) return 'managed'
  if (task.createWorktree === false) return 'local'
  return 'default'
}

const getBranchAction = (
  task: NonNullable<AutomationRule['tasks']>[number]
): NonNullable<RuleFormValues['tasks'][number]['branchAction']> => {
  if (task.branchName == null || task.branchName.trim() === '') return 'default'
  return task.branchMode === 'create' ? 'create' : 'checkout'
}

export function RuleFormPanel({
  isRulePanelCollapsed = false,
  mode,
  rule,
  submitting,
  onCreateRule,
  onExpandRulePanel,
  onSubmit,
  onCancel
}: RuleFormPanelProps) {
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
            prompt: '',
            ...DEFAULT_STARTUP_FORM_VALUES
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
      const tasks: RuleFormValues['tasks'] = (rule.tasks ?? []).map((task, index) => ({
        id: task.id,
        title: task.title || t('automation.taskDefaultTitle', { index: index + 1 }),
        prompt: task.prompt,
        model: task.model ?? DEFAULT_SELECT_VALUE,
        adapter: task.adapter ?? DEFAULT_SELECT_VALUE,
        effort: task.effort ?? 'default',
        permissionMode: task.permissionMode ?? 'default',
        createWorktreeMode: getCreateWorktreeMode(task),
        branchAction: getBranchAction(task),
        branchName: task.branchName ?? '',
        branchKind: task.branchKind ?? 'local'
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
          prompt: '',
          ...DEFAULT_STARTUP_FORM_VALUES
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
      tasks: values.tasks.map((task) => {
        const createWorktreeMode = task.createWorktreeMode ?? 'default'
        const branchAction = task.branchAction ?? 'default'
        return {
          id: task.id,
          title: task.title?.trim() ?? '',
          prompt: task.prompt.trim(),
          model: normalizeSelectText(task.model),
          adapter: normalizeSelectText(task.adapter),
          effort: task.effort === 'default' ? null : task.effort ?? null,
          permissionMode: task.permissionMode ?? 'default',
          createWorktree: createWorktreeMode === 'managed'
            ? true
            : createWorktreeMode === 'local'
            ? false
            : null,
          branchName: branchAction === 'default' ? null : normalizeSelectText(task.branchName),
          branchKind: branchAction === 'checkout' ? task.branchKind ?? 'local' : null,
          branchMode: branchAction === 'default' ? null : branchAction
        }
      }) as AutomationRule['tasks']
    }
    await onSubmit(payload, values.immediateRun)
  }, [form, onSubmit])

  return (
    <div className='automation-view__form-panel'>
      <div className='automation-view__form-header'>
        <div className='automation-view__form-title'>
          <AutomationPanelTitleActions
            collapsed={isRulePanelCollapsed}
            defaultIcon='edit_square'
            defaultIconClassName='automation-view__form-icon'
            isCreating={mode === 'create'}
            onCreateRule={onCreateRule}
            onExpandRulePanel={onExpandRulePanel}
          />
          {mode === 'create' ? t('automation.newRule') : t('automation.editRule')}
        </div>
        <div className='automation-view__form-header-actions'>
          <Tooltip title={t('common.cancel')}>
            <Button
              className='automation-view__square-button automation-view__square-button--cancel'
              aria-label={t('common.cancel')}
              icon={<span className='material-symbols-rounded automation-view__action-icon'>close</span>}
              onClick={onCancel}
            />
          </Tooltip>
          <Tooltip title={t('common.confirm')}>
            <Button
              className='automation-view__square-button automation-view__square-button--confirm'
              type='primary'
              aria-label={t('common.confirm')}
              loading={submitting}
              icon={<span className='material-symbols-rounded automation-view__action-icon'>check</span>}
              onClick={() => void handleSubmit()}
            />
          </Tooltip>
        </div>
      </div>
      <Form
        form={form}
        layout='vertical'
        initialValues={{
          enabled: true,
          immediateRun: false,
          tasks: [{
            ...DEFAULT_STARTUP_FORM_VALUES
          }]
        }}
      >
        <div className='automation-view__form-stack'>
          <div className='automation-view__form-section automation-view__form-section--basic'>
            <Form.Item
              name='name'
              rules={[{ required: true, message: t('automation.ruleNameRequired') }]}
            >
              <Input aria-label={t('automation.ruleName')} placeholder={t('automation.ruleNameRequired')} />
            </Form.Item>
            <Form.Item name='description'>
              <Input.TextArea
                aria-label={t('automation.ruleDescription')}
                placeholder={t('automation.ruleDescriptionPlaceholder')}
                rows={1}
              />
            </Form.Item>
            <div className='automation-view__toggle-group'>
              <div className='automation-view__toggle-row'>
                <span className='automation-view__toggle-label'>
                  <span className='material-symbols-rounded automation-view__label-icon'>toggle_on</span>
                  {t('automation.enabledStatus')}
                </span>
                <Form.Item name='enabled' valuePropName='checked' noStyle>
                  <Switch />
                </Form.Item>
              </div>
              <div className='automation-view__toggle-row'>
                <span className='automation-view__toggle-label automation-view__toggle-label--run'>
                  <span className='material-symbols-rounded automation-view__label-icon automation-view__label-icon--run'>
                    play_circle
                  </span>
                  {t('automation.immediateRun')}
                </span>
                <Form.Item name='immediateRun' valuePropName='checked' noStyle>
                  <Switch />
                </Form.Item>
              </div>
            </div>
          </div>

          <div className='automation-view__form-section'>
            <TriggerList
              form={form}
              updateWeeklyCron={updateWeeklyCron}
              getWebhookUrl={getWebhookUrl}
            />
          </div>

          <div className='automation-view__form-section'>
            <TaskList form={form} />
          </div>
        </div>
      </Form>
    </div>
  )
}
