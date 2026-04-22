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

type EditableRecommendedModel = Record<string, unknown> & {
  service?: string
  model?: string
  title?: string
  description?: string
  placement?: RecommendedModelConfig['placement']
}

export const RecommendedModelsItemEditor = ({
  value,
  onChange,
  mergedModelServices,
  t
}: {
  value: unknown
  onChange: (nextValue: Record<string, unknown>) => void
  mergedModelServices: Record<string, unknown>
  t: TranslationFn
}) => {
  const item: EditableRecommendedModel = isRecordObject(value)
    ? value as EditableRecommendedModel
    : {}
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

  const updateItem = (patch: Partial<EditableRecommendedModel>) => {
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
        <Select<string>
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
            <Select<string>
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
        <Select<RecommendedModelConfig['placement']>
          value={item.placement}
          options={[
            {
              value: 'modelSelector' as const,
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
