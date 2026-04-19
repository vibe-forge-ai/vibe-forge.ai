import './AuthGate.scss'

import { Alert, Button, Checkbox, Form, Input, Spin } from 'antd'
import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { getAuthStatus, login } from '#~/api/auth'
import { setAuthToken } from '#~/api/auth-token'
import { getApiErrorMessage } from '#~/api/base'
import { isServerConnectionManagedClientMode, requestServerConnectionPicker } from '#~/runtime-config'

interface LoginFormValues {
  username?: string
  password?: string
  rememberDevice?: boolean
}

export function AuthGate({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  const { data, error, isLoading, mutate } = useSWR('/api/auth/status', getAuthStatus)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const suggestedUsername = data?.usernames[0] ?? 'admin'
  const connectionManagedMode = isServerConnectionManagedClientMode()

  const handleChangeServer = () => {
    requestServerConnectionPicker({ clearCurrentServer: true })
    window.location.reload()
  }

  if (isLoading) {
    return (
      <div className='auth-gate auth-gate--loading'>
        <Spin size='large' />
      </div>
    )
  }

  if (error != null) {
    return (
      <div className='auth-gate'>
        <div className='auth-gate__panel'>
          <Alert
            type='error'
            showIcon
            message={t('auth.statusFailed')}
            description={getApiErrorMessage(error, t('auth.statusFailed'))}
          />
          {connectionManagedMode && (
            <Button
              className='auth-gate__secondary-action'
              htmlType='button'
              onClick={handleChangeServer}
              block
            >
              {t('auth.changeServer')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (data == null || !data.enabled || data.authenticated) {
    return children
  }

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const status = await login({
        username: values.username?.trim() ?? '',
        password: values.password ?? '',
        rememberDevice: values.rememberDevice === true,
        returnToken: connectionManagedMode
      })
      if (status.token != null) {
        setAuthToken(status.token)
      }
      await mutate(status, { revalidate: false })
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, t('auth.loginFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='auth-gate'>
      <main className='auth-gate__panel' aria-labelledby='auth-gate-title'>
        <div className='auth-gate__intro'>
          <h1 id='auth-gate-title'>{t('auth.title')}</h1>
          <p>{t('auth.subtitle')}</p>
        </div>

        {submitError != null && (
          <Alert
            type='error'
            showIcon
            className='auth-gate__notice'
            message={submitError}
          />
        )}

        <Form
          layout='vertical'
          requiredMark={false}
          initialValues={{ username: suggestedUsername, rememberDevice: true }}
          onFinish={(values: LoginFormValues) => void handleFinish(values)}
        >
          <Form.Item
            name='username'
            label={t('auth.username')}
            rules={[{ required: true, message: t('auth.usernameRequired') }]}
          >
            <Input
              autoComplete='username'
              size='large'
              placeholder={t('auth.usernamePlaceholder')}
            />
          </Form.Item>

          <Form.Item
            name='password'
            label={t('auth.password')}
            rules={[{ required: true, message: t('auth.passwordRequired') }]}
          >
            <Input.Password
              autoComplete='current-password'
              size='large'
              placeholder={t('auth.passwordPlaceholder')}
            />
          </Form.Item>

          <Form.Item name='rememberDevice' valuePropName='checked' className='auth-gate__remember'>
            <Checkbox>{t('auth.rememberDevice')}</Checkbox>
          </Form.Item>

          {data.passwordSource === 'generated' && (
            <p className='auth-gate__hint'>
              {t('auth.generatedPasswordHint', {
                path: data.passwordFilePath ?? '.data/web-auth-password'
              })}
            </p>
          )}

          <Button
            type='primary'
            htmlType='submit'
            size='large'
            loading={submitting}
            block
          >
            {t('auth.login')}
          </Button>

          {connectionManagedMode && (
            <Button
              className='auth-gate__secondary-action'
              htmlType='button'
              onClick={handleChangeServer}
              block
            >
              {t('auth.changeServer')}
            </Button>
          )}
        </Form>
      </main>
    </div>
  )
}
