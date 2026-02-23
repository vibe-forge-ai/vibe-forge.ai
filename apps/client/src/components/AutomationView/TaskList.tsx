import './TaskList.scss'

import { Button, Form, Input, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

export function TaskList() {
  const { t } = useTranslation()

  return (
    <Form.List name='tasks'>
      {(fields, { add, remove }) => (
        <div className='automation-view__list automation-view__list--horizontal'>
          <div className='automation-view__section-header'>
            <div className='automation-view__section-heading'>
              <div className='automation-view__form-title'>
                <span className='material-symbols-rounded automation-view__form-icon'>task</span>
                {t('automation.sectionTasks')}
              </div>
              <span className='automation-view__section-count'>
                {t('automation.taskCount', { count: fields.length })}
              </span>
            </div>
            <div className='automation-view__section-actions'>
              <Tooltip title={t('automation.addTask')}>
                <Button
                  className='automation-view__icon-button'
                  type='text'
                  onClick={() => add({
                    title: t('automation.taskDefaultTitle', { index: fields.length + 1 }),
                    prompt: ''
                  })}
                >
                  <span className='material-symbols-rounded automation-view__action-icon'>add</span>
                </Button>
              </Tooltip>
            </div>
          </div>
          <div className='automation-view__form-desc'>{t('automation.taskAll')}</div>
          <div className='automation-view__list-scroll'>
            {fields.map((field, index) => (
              <div key={field.key} className='automation-view__list-item'>
                <Form.Item name={[field.name, 'id']} hidden>
                  <Input />
                </Form.Item>
                <Tooltip title={t('automation.remove')}>
                  <Button
                    className='automation-view__remove-button'
                    danger
                    onClick={() => remove(field.name)}
                    disabled={fields.length <= 1}
                  >
                    <span className='material-symbols-rounded automation-view__button-icon'>close</span>
                  </Button>
                </Tooltip>
                <div className='automation-view__list-header'>
                  <Form.Item name={[field.name, 'title']} label={t('automation.taskTitle')}>
                    <Input placeholder={t('automation.taskTitlePlaceholder')} />
                  </Form.Item>
                </div>
                <Form.Item
                  name={[field.name, 'prompt']}
                  label={t('automation.prompt')}
                  rules={[{ required: true, message: t('automation.promptRequired') }]}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <div className='automation-view__task-index'>
                  <span className='material-symbols-rounded automation-view__task-index-icon'>format_list_numbered</span>
                  {t('automation.taskIndex', { index: index + 1 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Form.List>
  )
}
