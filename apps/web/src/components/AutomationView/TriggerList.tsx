import './TriggerList.scss'

import { Button, Form, Input, InputNumber, Select, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { RuleFormValues } from './types'

type TriggerListProps = {
  form: FormInstance<RuleFormValues>
  updateWeeklyCron: (index: number, nextDay?: string, nextTime?: string) => void
  getWebhookUrl: (triggerId?: string, webhookKey?: string) => string
}

export function TriggerList({ form, updateWeeklyCron, getWebhookUrl }: TriggerListProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <Form.List name='triggers'>
      {(fields, { add, remove }) => (
        <div className='automation-view__list automation-view__list--horizontal'>
          <div className='automation-view__section-header'>
            <div className='automation-view__section-heading'>
              <div className='automation-view__form-title'>
                <span className='material-symbols-rounded automation-view__form-icon'>bolt</span>
                {t('automation.sectionTriggers')}
              </div>
              <span className='automation-view__section-count'>
                {t('automation.triggerCount', { count: fields.length })}
              </span>
            </div>
            <div className='automation-view__section-actions'>
              <Tooltip title={collapsed ? t('common.expand') : t('common.collapse')}>
                <Button
                  className='automation-view__icon-button'
                  type='text'
                  onClick={() => setCollapsed(value => !value)}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>
                    {collapsed ? 'expand_more' : 'expand_less'}
                  </span>
                </Button>
              </Tooltip>
              <Tooltip title={t('automation.addTrigger')}>
                <Button
                  className='automation-view__icon-button'
                  type='text'
                  onClick={() => add({
                    type: 'interval',
                    intervalMinutes: 30,
                    cronExpression: '',
                    weeklyDay: '1',
                    weeklyTime: '09:00'
                  })}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>add</span>
                </Button>
              </Tooltip>
            </div>
          </div>
          {!collapsed && (
            <>
              <div className='automation-view__form-desc'>{t('automation.triggerAny')}</div>
              <div className='automation-view__list-scroll'>
                {fields.map((field, index) => {
                  const triggerType = form.getFieldValue(['triggers', field.name, 'type']) as RuleFormValues['triggers'][number]['type']
                  const triggerId = form.getFieldValue(['triggers', field.name, 'id']) as string | undefined
                  const webhookKey = form.getFieldValue(['triggers', field.name, 'webhookKey']) as string | undefined
                  const webhookUrl = getWebhookUrl(triggerId, webhookKey)
                  return (
                    <div key={field.key} className='automation-view__list-item'>
                      <Form.Item name={[field.name, 'id']} hidden>
                        <Input />
                      </Form.Item>
                      <Tooltip title={t('automation.remove')}>
                        <Button
                          className='automation-view__remove-button'
                          type='text'
                          danger
                          onClick={() => remove(field.name)}
                          disabled={fields.length <= 1}
                        >
                          <span className='material-symbols-rounded automation-view__action-icon'>close</span>
                        </Button>
                      </Tooltip>
                      <div className='automation-view__list-header'>
                        <Form.Item
                          name={[field.name, 'type']}
                          label={t('automation.ruleType')}
                          rules={[{ required: true, message: t('automation.ruleTypeRequired') }]}
                        >
                          <Select
                            options={[
                              { label: t('automation.typeInterval'), value: 'interval' },
                              { label: t('automation.typeWebhook'), value: 'webhook' },
                              { label: t('automation.typeCron'), value: 'cron' }
                            ]}
                            onChange={(value) => {
                              if (value === 'interval') {
                                form.setFieldValue(['triggers', field.name, 'intervalMinutes'], 30)
                                form.setFieldValue(['triggers', field.name, 'cronExpression'], '')
                                form.setFieldValue(['triggers', field.name, 'weeklyDay'], '1')
                                form.setFieldValue(['triggers', field.name, 'weeklyTime'], '09:00')
                                form.setFieldValue(['triggers', field.name, 'webhookKey'], '')
                              }
                              if (value === 'cron') {
                                form.setFieldValue(['triggers', field.name, 'cronExpression'], '')
                                form.setFieldValue(['triggers', field.name, 'weeklyDay'], '1')
                                form.setFieldValue(['triggers', field.name, 'weeklyTime'], '09:00')
                                form.setFieldValue(['triggers', field.name, 'intervalMinutes'], 30)
                                form.setFieldValue(['triggers', field.name, 'webhookKey'], '')
                              }
                              if (value === 'webhook') {
                                form.setFieldValue(['triggers', field.name, 'webhookKey'], '')
                                form.setFieldValue(['triggers', field.name, 'intervalMinutes'], 30)
                                form.setFieldValue(['triggers', field.name, 'cronExpression'], '')
                                form.setFieldValue(['triggers', field.name, 'weeklyDay'], '1')
                                form.setFieldValue(['triggers', field.name, 'weeklyTime'], '09:00')
                              }
                            }}
                          />
                        </Form.Item>
                      </div>

                      {triggerType === 'interval' && (
                        <Form.Item
                          name={[field.name, 'intervalMinutes']}
                          label={t('automation.intervalMinutes')}
                          rules={[{ required: true, message: t('automation.intervalRequired') }]}
                        >
                          <InputNumber min={1} className='automation-view__input-number' />
                        </Form.Item>
                      )}
                      {triggerType === 'cron' && (
                        <div className='automation-view__cron-section'>
                          <Form.Item
                            name={[field.name, 'cronExpression']}
                            label={t('automation.cronExpressionLabel')}
                            rules={[{ required: true, message: t('automation.cronExpressionRequired') }]}
                          >
                            <Input placeholder={t('automation.cronExpressionHint')} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'cronPreset']}
                            label={t('automation.cronPreset')}
                          >
                            <Select
                              options={[
                                { label: t('automation.cronPresetHourly'), value: '0 * * * *' },
                                { label: t('automation.cronPresetDaily9'), value: '0 9 * * *' },
                                { label: t('automation.cronPresetWeekday9'), value: '0 9 * * 1-5' },
                                { label: t('automation.cronPresetWeekend10'), value: '0 10 * * 6,0' }
                              ]}
                              onChange={(value) => form.setFieldValue(['triggers', field.name, 'cronExpression'], value)}
                              placeholder={t('automation.cronPresetHint')}
                              allowClear
                            />
                          </Form.Item>
                          <div className='automation-view__cron-hint'>{t('automation.cronInputHint')}</div>
                          <div className='automation-view__cron-weekly'>
                            <Form.Item name={[field.name, 'weeklyDay']} label={t('automation.weeklyDay')}>
                              <Select
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
                            <Form.Item name={[field.name, 'weeklyTime']} label={t('automation.weeklyTime')}>
                              <Input
                                placeholder={t('automation.weeklyTimeHint')}
                                onChange={(event) => updateWeeklyCron(index, undefined, event.target.value)}
                              />
                            </Form.Item>
                          </div>
                        </div>
                      )}
                      {triggerType === 'webhook' && (
                        <div className='automation-view__webhook'>
                          <Form.Item name={[field.name, 'webhookKey']} label={t('automation.webhookKey')}>
                            <Input placeholder={t('automation.webhookKeyHint')} />
                          </Form.Item>
                          {webhookUrl && (
                            <div className='automation-view__webhook-row'>
                              <span className='automation-view__webhook-label'>{t('automation.webhookUrl')}</span>
                              <Tooltip title={t('automation.copy')}>
                                <Button
                                  className='automation-view__icon-button'
                                  type='text'
                                  onClick={() => {
                                    void navigator.clipboard.writeText(webhookUrl)
                                  }}
                                >
                                  <span className='material-symbols-rounded automation-view__action-icon'>content_copy</span>
                                </Button>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </Form.List>
  )
}
