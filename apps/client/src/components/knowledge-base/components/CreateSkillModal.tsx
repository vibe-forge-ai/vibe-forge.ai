import { Form, Input, Modal } from 'antd'
import type { FormInstance } from 'antd'
import { useTranslation } from 'react-i18next'

export interface CreateSkillFormValues {
  name: string
  description?: string
  body?: string
}

interface CreateSkillModalProps {
  open: boolean
  saving: boolean
  form: FormInstance<CreateSkillFormValues>
  onSave: () => void
  onClose: () => void
}

export function CreateSkillModal({
  open,
  saving,
  form,
  onSave,
  onClose
}: CreateSkillModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('knowledge.skills.create')}
      open={open}
      confirmLoading={saving}
      okText={t('config.actions.save')}
      cancelText={t('config.actions.cancel')}
      onOk={onSave}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout='vertical' className='knowledge-base-view__create-skill-form'>
        <Form.Item
          name='name'
          label={t('knowledge.skills.skillName')}
          rules={[{ required: true, message: t('knowledge.skills.skillNameRequired') }]}
        >
          <Input placeholder={t('knowledge.skills.skillNamePlaceholder')} />
        </Form.Item>
        <Form.Item name='description' label={t('knowledge.skills.skillDescription')}>
          <Input placeholder={t('knowledge.skills.skillDescriptionPlaceholder')} />
        </Form.Item>
        <Form.Item name='body' label={t('knowledge.skills.skillBody')}>
          <Input.TextArea
            autoSize={{ minRows: 5, maxRows: 10 }}
            placeholder={t('knowledge.skills.skillBodyPlaceholder')}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
