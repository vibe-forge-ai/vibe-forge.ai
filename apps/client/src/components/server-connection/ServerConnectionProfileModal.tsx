import { App, Button, Form, Input, Modal } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  clearAuthTokenForServerUrl,
  removeServerConnectionProfile,
  updateServerConnectionProfile
} from '#~/server-connection-history'
import type { ServerConnectionProfile } from '#~/server-connection-history'

interface ProfileFormValues {
  alias?: string
  description?: string
}

const hasAuthToken = (profile: ServerConnectionProfile) => (
  profile.authToken != null && profile.authToken.trim() !== ''
)

const renderIconLabel = (icon: string, label: string) => (
  <span className='server-connection-gate__modal-label'>
    <span className='material-symbols-rounded'>{icon}</span>
    <span>{label}</span>
  </span>
)

export function ServerConnectionProfileModal({
  profile,
  onClose,
  onProfilesChange
}: {
  profile: ServerConnectionProfile | null
  onClose: () => void
  onProfilesChange: (profiles: ServerConnectionProfile[]) => void
}) {
  const { t } = useTranslation()
  const { modal } = App.useApp()
  const [form] = Form.useForm<ProfileFormValues>()

  useEffect(() => {
    if (profile == null) return
    form.setFieldsValue({
      alias: profile.alias ?? '',
      description: profile.description ?? ''
    })
  }, [form, profile])

  const handleSave = async () => {
    if (profile == null) return
    const values = await form.validateFields()
    onProfilesChange(updateServerConnectionProfile(profile.serverUrl, values))
    onClose()
  }

  const handleClearLoginState = () => {
    if (profile == null) return
    modal.confirm({
      title: t('serverConnection.clearLoginState'),
      content: t('serverConnection.clearLoginStateConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        onProfilesChange(clearAuthTokenForServerUrl(profile.serverUrl))
        onClose()
      }
    })
  }

  const handleRemoveProfile = () => {
    if (profile == null) return
    modal.confirm({
      title: t('serverConnection.removeProfile'),
      content: t('serverConnection.removeProfileConfirm'),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        onProfilesChange(removeServerConnectionProfile(profile.serverUrl))
        onClose()
      }
    })
  }

  return (
    <Modal
      open={profile != null}
      title={renderIconLabel('tune', t('serverConnection.manageProfile'))}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onOk={() => void handleSave()}
      onCancel={onClose}
    >
      {profile != null && (
        <div className='server-connection-gate__profile-modal'>
          <div className='server-connection-gate__profile-modal-url'>
            <span className='material-symbols-rounded'>link</span>
            <span>{profile.serverUrl}</span>
          </div>
          <div className={`server-connection-gate__profile-modal-auth ${hasAuthToken(profile) ? 'is-saved' : ''}`}>
            <span className='material-symbols-rounded'>
              {hasAuthToken(profile) ? 'verified_user' : 'lock_open'}
            </span>
            <strong>
              {hasAuthToken(profile) ? t('serverConnection.loginSaved') : t('serverConnection.loginMissing')}
            </strong>
          </div>
          <Form form={form} layout='vertical' requiredMark={false}>
            <Form.Item name='alias' label={renderIconLabel('label', t('serverConnection.profileAlias'))}>
              <Input placeholder={t('serverConnection.profileAliasPlaceholder')} />
            </Form.Item>
            <Form.Item name='description' label={renderIconLabel('notes', t('serverConnection.profileDescription'))}>
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder={t('serverConnection.profileDescriptionPlaceholder')}
              />
            </Form.Item>
          </Form>
          <div className='server-connection-gate__profile-modal-actions'>
            {hasAuthToken(profile) && (
              <Button
                danger
                htmlType='button'
                icon={<span className='material-symbols-rounded'>lock_reset</span>}
                onClick={handleClearLoginState}
              >
                {t('serverConnection.clearLoginState')}
              </Button>
            )}
            <Button
              danger
              htmlType='button'
              type='text'
              icon={<span className='material-symbols-rounded'>delete</span>}
              onClick={handleRemoveProfile}
            >
              {t('serverConnection.removeProfile')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
