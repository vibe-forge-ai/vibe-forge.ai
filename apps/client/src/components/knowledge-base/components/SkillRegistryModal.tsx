import { Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import { useTranslation } from 'react-i18next'

import type { RegistryFormValues } from './skill-hub-utils'
import { getSourcePlaceholderKey } from './skill-hub-utils'

interface SkillRegistryModalProps {
  open: boolean
  saving: boolean
  form: FormInstance<RegistryFormValues>
  onSave: () => void
  onClose: () => void
}

export function SkillRegistryModal({
  open,
  saving,
  form,
  onSave,
  onClose
}: SkillRegistryModalProps) {
  const { t } = useTranslation()
  const sourceKind = Form.useWatch('source', form)

  return (
    <Modal
      title={t('knowledge.skills.addRegistry')}
      open={open}
      confirmLoading={saving}
      okText={t('config.actions.save')}
      cancelText={t('config.actions.cancel')}
      onOk={onSave}
      onCancel={onClose}
      destroyOnClose
    >
      <Form
        form={form}
        layout='vertical'
        initialValues={{ source: 'url' }}
        className='knowledge-base-view__registry-form'
      >
        <Form.Item
          name='id'
          label={t('knowledge.skills.registryName')}
          rules={[{ required: true, message: t('knowledge.skills.registryNameRequired') }]}
        >
          <Input placeholder={t('knowledge.skills.registryNamePlaceholder')} />
        </Form.Item>
        <Form.Item
          name='source'
          label={t('knowledge.skills.registrySource')}
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: t('knowledge.skills.registryUrl'), value: 'url' },
              { label: t('knowledge.skills.registryDirectory'), value: 'directory' },
              { label: t('knowledge.skills.registryGithub'), value: 'github' },
              { label: t('knowledge.skills.registryGit'), value: 'git' }
            ]}
          />
        </Form.Item>
        <Form.Item
          name='value'
          label={t('knowledge.skills.registryValue')}
          rules={[{ required: true, message: t('knowledge.skills.registryValueRequired') }]}
        >
          <Input placeholder={t(getSourcePlaceholderKey(sourceKind))} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
