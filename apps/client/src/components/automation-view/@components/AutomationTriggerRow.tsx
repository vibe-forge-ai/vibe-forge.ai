import { Button, Form, Input, InputNumber, Select, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { RuleFormValues } from '../types'

interface AutomationTriggerRowProps {
  fieldName: number
  form: FormInstance<RuleFormValues>
  getWebhookUrl: (triggerId?: string, webhookKey?: string) => string
  index: number
  remove: (name: number) => void
  triggerCount: number
  updateWeeklyCron: (index: number, nextDay?: string, nextTime?: string) => void
}

const resetTriggerFields = (
  form: FormInstance<RuleFormValues>,
  fieldName: number,
  value: RuleFormValues['triggers'][number]['type']
) => {
  form.setFieldValue(['triggers', fieldName, 'intervalMinutes'], 30)
  form.setFieldValue(['triggers', fieldName, 'cronExpression'], '')
  form.setFieldValue(['triggers', fieldName, 'weeklyDay'], '1')
  form.setFieldValue(['triggers', fieldName, 'weeklyTime'], '09:00')
  form.setFieldValue(['triggers', fieldName, 'webhookKey'], '')
  if (value !== 'cron') {
    form.setFieldValue(['triggers', fieldName, 'cronPreset'], undefined)
  }
}

export function AutomationTriggerRow({
  fieldName,
  form,
  getWebhookUrl,
  index,
  remove,
  triggerCount,
  updateWeeklyCron
}: AutomationTriggerRowProps) {
  const { t } = useTranslation()

  return (
    <Form.Item
      noStyle
      shouldUpdate={(prevValues, nextValues) => {
        const prevTrigger = prevValues.triggers?.[fieldName]
        const nextTrigger = nextValues.triggers?.[fieldName]
        return prevTrigger?.type !== nextTrigger?.type ||
          prevTrigger?.webhookKey !== nextTrigger?.webhookKey ||
          prevTrigger?.id !== nextTrigger?.id
      }}
    >
      {(formInstance) => {
        const triggerType = formInstance.getFieldValue([
          'triggers',
          fieldName,
          'type'
        ]) as RuleFormValues['triggers'][number]['type']
        const triggerId = formInstance.getFieldValue(['triggers', fieldName, 'id']) as string | undefined
        const webhookKey = formInstance.getFieldValue(['triggers', fieldName, 'webhookKey']) as string | undefined
        const webhookUrl = getWebhookUrl(triggerId, webhookKey)
        return (
          <div className='automation-view__trigger-row'>
            <Form.Item name={[fieldName, 'id']} hidden>
              <Input />
            </Form.Item>
            <div className='automation-view__trigger-type'>
              <Form.Item
                name={[fieldName, 'type']}
                rules={[{ required: true, message: t('automation.ruleTypeRequired') }]}
              >
                <Select
                  aria-label={t('automation.ruleType')}
                  options={[
                    { label: t('automation.typeInterval'), value: 'interval' },
                    { label: t('automation.typeWebhook'), value: 'webhook' },
                    { label: t('automation.typeCron'), value: 'cron' }
                  ]}
                  onChange={(value) => resetTriggerFields(form, fieldName, value)}
                />
              </Form.Item>
            </div>
            <div className='automation-view__trigger-config'>
              {triggerType === 'interval' && (
                <Form.Item
                  name={[fieldName, 'intervalMinutes']}
                  rules={[{ required: true, message: t('automation.intervalRequired') }]}
                >
                  <InputNumber
                    min={1}
                    aria-label={t('automation.intervalMinutes')}
                    className='automation-view__input-number'
                  />
                </Form.Item>
              )}
              {triggerType === 'cron' && (
                <div className='automation-view__cron-section'>
                  <Form.Item
                    name={[fieldName, 'cronExpression']}
                    rules={[{ required: true, message: t('automation.cronExpressionRequired') }]}
                  >
                    <Input
                      aria-label={t('automation.cronExpressionLabel')}
                      placeholder={t('automation.cronExpressionHint')}
                    />
                  </Form.Item>
                  <Form.Item name={[fieldName, 'cronPreset']}>
                    <Select
                      aria-label={t('automation.cronPreset')}
                      options={[
                        { label: t('automation.cronPresetHourly'), value: '0 * * * *' },
                        { label: t('automation.cronPresetDaily9'), value: '0 9 * * *' },
                        { label: t('automation.cronPresetWeekday9'), value: '0 9 * * 1-5' },
                        { label: t('automation.cronPresetWeekend10'), value: '0 10 * * 6,0' }
                      ]}
                      onChange={(value) => form.setFieldValue(['triggers', fieldName, 'cronExpression'], value)}
                      placeholder={t('automation.cronPresetHint')}
                      allowClear
                    />
                  </Form.Item>
                  <div className='automation-view__cron-weekly'>
                    <Form.Item name={[fieldName, 'weeklyDay']}>
                      <Select
                        aria-label={t('automation.weeklyDay')}
                        options={[
                          { label: t('automation.weekdaySun'), value: '0' },
                          { label: t('automation.weekdayMon'), value: '1' },
                          { label: t('automation.weekdayTue'), value: '2' },
                          { label: t('automation.weekdayWed'), value: '3' },
                          { label: t('automation.weekdayThu'), value: '4' },
                          { label: t('automation.weekdayFri'), value: '5' },
                          { label: t('automation.weekdaySat'), value: '6' }
                        ]}
                        onChange={(value) => updateWeeklyCron(index, value)}
                      />
                    </Form.Item>
                    <Form.Item name={[fieldName, 'weeklyTime']}>
                      <Input
                        aria-label={t('automation.weeklyTime')}
                        placeholder={t('automation.weeklyTimeHint')}
                        onChange={(event) => updateWeeklyCron(index, undefined, event.target.value)}
                      />
                    </Form.Item>
                  </div>
                </div>
              )}
              {triggerType === 'webhook' && (
                <div className='automation-view__webhook'>
                  <Form.Item name={[fieldName, 'webhookKey']}>
                    <Input aria-label={t('automation.webhookKey')} placeholder={t('automation.webhookKeyHint')} />
                  </Form.Item>
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
            <div className='automation-view__trigger-actions'>
              <Tooltip title={t('automation.remove')}>
                <Button
                  className='automation-view__trigger-remove-button'
                  type='text'
                  onClick={() => remove(fieldName)}
                  disabled={triggerCount <= 1}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>close</span>
                </Button>
              </Tooltip>
            </div>
          </div>
        )
      }}
    </Form.Item>
  )
}
