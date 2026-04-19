import './TriggerList.scss'

import { Button, Form, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { AutomationTriggerRow } from './@components/AutomationTriggerRow'
import type { RuleFormValues } from './types'

interface TriggerListProps {
  form: FormInstance<RuleFormValues>
  updateWeeklyCron: (index: number, nextDay?: string, nextTime?: string) => void
  getWebhookUrl: (triggerId?: string, webhookKey?: string) => string
}

export function TriggerList({ form, updateWeeklyCron, getWebhookUrl }: TriggerListProps) {
  const { t } = useTranslation()

  return (
    <Form.List name='triggers'>
      {(fields, { add, remove }) => (
        <div className='automation-view__list automation-view__trigger-list'>
          <div className='automation-view__section-header'>
            <div className='automation-view__section-heading'>
              <div className='automation-view__form-title'>
                <span className='material-symbols-rounded automation-view__form-icon'>bolt</span>
                {t('automation.sectionTriggers')}
              </div>
            </div>
            <div className='automation-view__section-actions'>
              <Tooltip title={t('automation.addTrigger')}>
                <Button
                  className='automation-view__icon-button automation-view__icon-button--section-add'
                  type='text'
                  onClick={() =>
                    add({
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
          <div className='automation-view__trigger-rows'>
            {fields.map((field, index) => (
              <AutomationTriggerRow
                key={field.key}
                fieldName={field.name}
                form={form}
                getWebhookUrl={getWebhookUrl}
                index={index}
                remove={remove}
                triggerCount={fields.length}
                updateWeeklyCron={updateWeeklyCron}
              />
            ))}
          </div>
        </div>
      )}
    </Form.List>
  )
}
