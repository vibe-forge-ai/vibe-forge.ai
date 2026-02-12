import './ModelServicesRecordEditor.scss'

import { Button, Input, Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import { ComplexTextEditor, StringArrayEditor } from '../ConfigEditors'
import { FieldRow } from '../ConfigFieldRow'
import { getTypeIcon } from '../configUtils'
import type { TranslationFn } from '../configUtils'

export const ModelServicesRecordEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = useMemo(() => Object.entries(value), [value])
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(entries.map(([key]) => [key, true]))
  ))

  useEffect(() => {
    setCollapsedKeys(prev => {
      const next: Record<string, boolean> = {}
      for (const [key] of entries) {
        next[key] = prev[key] ?? true
      }
      return next
    })
  }, [entries])

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => {
        const recordValue = (itemValue != null && typeof itemValue === 'object')
          ? itemValue as Record<string, unknown>
          : {}
        const titleValue = typeof recordValue.title === 'string' ? recordValue.title : ''
        const descriptionValue = typeof recordValue.description === 'string' ? recordValue.description : ''
        const displayName = titleValue.trim() !== '' ? titleValue : key
        const models = Array.isArray(recordValue.models)
          ? recordValue.models.filter(item => typeof item === 'string')
          : []

        const isCollapsed = collapsedKeys[key] === true
        return (
          <div
            key={key}
            className={`config-view__record-card${isCollapsed ? ' config-view__record-card--collapsed' : ''}`}
          >
            <div className='config-view__record-title'>
              <div className='config-view__record-title-left'>
                <Tooltip title={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}>
                  <Button
                    size='small'
                    type='text'
                    className='config-view__icon-button config-view__icon-button--compact'
                    aria-label={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}
                    icon={<span className='material-symbols-rounded'>{isCollapsed ? 'chevron_right' : 'expand_more'}</span>}
                    onClick={() => {
                      setCollapsedKeys(prev => ({ ...prev, [key]: !isCollapsed }))
                    }}
                  />
                </Tooltip>
                <div className='config-view__record-heading'>
                  <div>{displayName}</div>
                  {displayName !== key && (
                    <div className='config-view__record-subtitle'>{key}</div>
                  )}
                  {descriptionValue !== '' && (
                    <div className='config-view__record-desc'>{descriptionValue}</div>
                  )}
                </div>
              </div>
              <Tooltip title={t('config.editor.remove')}>
                <Button
                  size='small'
                  type='text'
                  danger
                  className='config-view__icon-button config-view__icon-button--compact'
                  aria-label={t('config.editor.remove')}
                  icon={<span className='material-symbols-rounded'>delete</span>}
                  onClick={() => {
                    const updated = { ...value }
                    delete updated[key]
                    onChange(updated)
                  }}
                />
              </Tooltip>
            </div>
            <div className='config-view__record-body'>
              <div className='config-view__record-fields'>
              <FieldRow
                title={t('config.fields.modelServices.item.title.label')}
                description={t('config.fields.modelServices.item.title.desc')}
                icon={getTypeIcon('string')}
              >
                <Input
                  value={titleValue}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, title: event.target.value } })
                  }}
                  placeholder={t('config.editor.titlePlaceholder')}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.description.label')}
                description={t('config.fields.modelServices.item.description.desc')}
                icon={getTypeIcon('string')}
                layout='stacked'
              >
                <Input.TextArea
                  value={descriptionValue}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, description: event.target.value } })
                  }}
                  autoSize={{ minRows: 2 }}
                  placeholder={t('config.editor.descriptionPlaceholder')}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.apiBaseUrl.label')}
                description={t('config.fields.modelServices.item.apiBaseUrl.desc')}
                icon={getTypeIcon('string')}
              >
                <Input
                  value={typeof recordValue.apiBaseUrl === 'string' ? recordValue.apiBaseUrl : ''}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, apiBaseUrl: event.target.value } })
                  }}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.apiKey.label')}
                description={t('config.fields.modelServices.item.apiKey.desc')}
                icon={getTypeIcon('string')}
              >
                <Input.Password
                  value={typeof recordValue.apiKey === 'string' ? recordValue.apiKey : ''}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, apiKey: event.target.value } })
                  }}
                  placeholder={t('config.editor.secretPlaceholder')}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.models.label')}
                description={t('config.fields.modelServices.item.models.desc')}
                icon={getTypeIcon('array')}
                layout='stacked'
              >
                <StringArrayEditor
                  value={models}
                  onChange={(next) => {
                    onChange({ ...value, [key]: { ...recordValue, models: next } })
                  }}
                  t={t}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.modelsAlias.label')}
                description={t('config.fields.modelServices.item.modelsAlias.desc')}
                icon={getTypeIcon('object')}
                layout='stacked'
              >
                <ComplexTextEditor
                  value={recordValue.modelsAlias ?? {}}
                  onChange={(next) => {
                    onChange({ ...value, [key]: { ...recordValue, modelsAlias: next } })
                  }}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.extra.label')}
                description={t('config.fields.modelServices.item.extra.desc')}
                icon={getTypeIcon('object')}
                layout='stacked'
              >
                <ComplexTextEditor
                  value={recordValue.extra ?? {}}
                  onChange={(next) => {
                    onChange({ ...value, [key]: { ...recordValue, extra: next } })
                  }}
                />
              </FieldRow>
              </div>
            </div>
          </div>
        )
      })}
      <div className='config-view__record-add'>
        <div className='config-view__record-add-inputs'>
          <Input
            value={newKey}
            placeholder={t('config.editor.fieldKey')}
            onChange={(event) => setNewKey(event.target.value)}
          />
        </div>
        <Tooltip title={t('config.editor.addModelService')}>
          <Button
            size='small'
            type='primary'
            className='config-view__icon-button config-view__icon-button--full'
            aria-label={t('config.editor.addModelService')}
            icon={<span className='material-symbols-rounded'>add</span>}
            disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
            onClick={() => {
              onChange({
                ...value,
                [newKey]: {
                  title: '',
                  description: '',
                  apiBaseUrl: '',
                  apiKey: '',
                  models: [],
                  modelsAlias: {},
                  extra: {}
                }
              })
              setNewKey('')
            }}
          />
        </Tooltip>
      </div>
    </div>
  )
}
