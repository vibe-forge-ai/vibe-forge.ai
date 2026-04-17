import { Input, Select } from 'antd'

import type { RecommendedModelConfig } from '@vibe-forge/types'

import { FieldRow } from './ConfigFieldRow'
import { getTypeIcon } from './configUtils'
import type { TranslationFn } from './configUtils'

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

export const RecommendedModelsItemEditor = ({
  value,
  onChange,
  mergedModelServices,
  t
}: {
  value: unknown
  onChange: (nextValue: RecommendedModelConfig & Record<string, unknown>) => void
  mergedModelServices: Record<string, unknown>
  t: TranslationFn
}) => {
  const item = isRecordObject(value) ? value : {}
  const serviceKey = typeof item.service === 'string' ? item.service : undefined
  const serviceOptions = Object.entries(mergedModelServices).map(([key, entry]) => {
    const record = isRecordObject(entry) ? entry : {}
    const title = typeof record.title === 'string' && record.title.trim() !== '' ? record.title : key
    return {
      value: key,
      label: title
    }
  })
  const serviceRecord = serviceKey != null && isRecordObject(mergedModelServices[serviceKey])
    ? mergedModelServices[serviceKey] as Record<string, unknown>
    : undefined
  const serviceModels = Array.isArray(serviceRecord?.models)
    ? serviceRecord.models.filter((model): model is string => typeof model === 'string')
    : []

  const updateItem = (patch: Partial<RecommendedModelConfig>) => {
    onChange({
      ...item,
      ...patch
    })
  }

  return (
    <div className='config-view__field-stack'>
      <FieldRow
        title={t('config.fields.general.recommendedModels.item.service.label')}
        description={t('config.fields.general.recommendedModels.item.service.desc')}
        icon={getTypeIcon('string')}
      >
        <Select
          value={serviceKey}
          options={serviceOptions}
          onChange={(nextValue) => {
            updateItem({
              service: nextValue,
              model: undefined
            })
          }}
          allowClear
          placeholder={t('config.editor.defaultModelServicePlaceholder')}
        />
      </FieldRow>
      <FieldRow
        title={t('config.fields.general.recommendedModels.item.model.label')}
        description={t('config.fields.general.recommendedModels.item.model.desc')}
        icon={getTypeIcon('string')}
      >
        {serviceModels.length > 0
          ? (
            <Select
              value={typeof item.model === 'string' && item.model !== '' ? item.model : undefined}
              options={serviceModels.map(model => ({ value: model, label: model }))}
              onChange={(nextValue) => updateItem({ model: nextValue })}
              allowClear
              placeholder={t('config.editor.defaultModelPlaceholder')}
            />
          )
          : (
            <Input
              value={typeof item.model === 'string' ? item.model : ''}
              onChange={(event) => updateItem({ model: event.target.value })}
              placeholder={t('config.editor.defaultModelPlaceholder')}
            />
          )}
      </FieldRow>
      <FieldRow
        title={t('config.fields.general.recommendedModels.item.title.label')}
        description={t('config.fields.general.recommendedModels.item.title.desc')}
        icon={getTypeIcon('string')}
      >
        <Input
          value={typeof item.title === 'string' ? item.title : ''}
          onChange={(event) => updateItem({ title: event.target.value })}
          placeholder={t('config.editor.titlePlaceholder')}
        />
      </FieldRow>
      <FieldRow
        title={t('config.fields.general.recommendedModels.item.description.label')}
        description={t('config.fields.general.recommendedModels.item.description.desc')}
        icon={getTypeIcon('string')}
        layout='stacked'
      >
        <Input.TextArea
          value={typeof item.description === 'string' ? item.description : ''}
          onChange={(event) => updateItem({ description: event.target.value })}
          autoSize={{ minRows: 4 }}
          placeholder={t('config.editor.descriptionPlaceholder')}
        />
      </FieldRow>
      <FieldRow
        title={t('config.fields.general.recommendedModels.item.placement.label')}
        description={t('config.fields.general.recommendedModels.item.placement.desc')}
        icon={getTypeIcon('string')}
      >
        <Select
          value={typeof item.placement === 'string' && item.placement !== '' ? item.placement : undefined}
          options={[
            {
              value: 'modelSelector',
              label: t('config.options.recommendedModels.modelSelector')
            }
          ]}
          onChange={(nextValue) => updateItem({ placement: nextValue })}
          allowClear
        />
      </FieldRow>
    </div>
  )
}
