import './TaskList.scss'

import { Button, Form, Input, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { AutomationTaskComposer } from './@components/AutomationTaskComposer'
import { DEFAULT_STARTUP_FORM_VALUES } from './@utils/startup-options'
import type { RuleFormValues } from './types'

export function TaskList({ form }: { form: FormInstance<RuleFormValues> }) {
  const { t } = useTranslation()

  return (
    <Form.List name='tasks'>
      {(fields, { add, remove }) => (
        <div className='automation-view__task-list'>
          <div className='automation-view__section-header'>
            <div className='automation-view__section-heading'>
              <div className='automation-view__form-title'>
                <span className='material-symbols-rounded automation-view__form-icon'>task</span>
                {t('automation.sectionTasks')}
              </div>
            </div>
            <div className='automation-view__section-actions'>
              <Tooltip title={t('automation.addTask')}>
                <Button
                  className='automation-view__icon-button automation-view__icon-button--section-add'
                  type='text'
                  onClick={() =>
                    add({
                      title: t('automation.taskDefaultTitle', { index: fields.length + 1 }),
                      prompt: '',
                      ...DEFAULT_STARTUP_FORM_VALUES
                    })}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>add</span>
                </Button>
              </Tooltip>
            </div>
          </div>
          <div className='automation-view__task-stack'>
            {fields.map((field) => (
              <div key={field.key} className='automation-view__task-card'>
                <Form.Item name={[field.name, 'id']} hidden>
                  <Input />
                </Form.Item>
                <Tooltip title={t('automation.remove')}>
                  <Button
                    className='automation-view__task-remove-button'
                    type='text'
                    onClick={() => remove(field.name)}
                    disabled={fields.length <= 1}
                  >
                    <span className='material-symbols-rounded automation-view__action-icon'>close</span>
                  </Button>
                </Tooltip>
                <AutomationTaskComposer fieldName={field.name} form={form} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Form.List>
  )
}
