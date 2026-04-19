import { Button, Dropdown, Empty } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import { listWorktreeEnvironments } from '#~/api'
import { toDisplayEnvironmentName, toEnvironmentReference } from '#~/components/config/worktree-environment-panel-model'

export function DraftWorktreeEnvironmentDropdown({
  compact = false,
  disabled = false,
  value,
  placement = 'topLeft',
  onChange
}: {
  compact?: boolean
  disabled?: boolean
  value?: string
  placement?: 'bottomLeft' | 'topLeft'
  onChange: (value?: string) => void
}) {
  const { t } = useTranslation()
  const { data } = useSWR('worktree-environments', listWorktreeEnvironments, { revalidateOnFocus: false })
  const environments = data?.environments ?? []
  const selectedEnvironment = environments.find(environment => (
    toEnvironmentReference(environment) === value || environment.id === value
  ))
  const triggerLabel = selectedEnvironment != null
    ? toDisplayEnvironmentName(selectedEnvironment.id)
    : value != null && value !== ''
    ? toDisplayEnvironmentName(value)
    : t('chat.sessionWorkspaceEnvironmentDefault')
  const hasEnvironments = environments.length > 0

  const menuRows = useMemo(() => (
    <div className='chat-header-git__overlay chat-header-git__overlay--environment'>
      <button
        type='button'
        className={`chat-header-git__menu-row ${value == null || value === '' ? 'is-active' : ''}`}
        disabled={disabled}
        onClick={() => onChange(undefined)}
      >
        <span className='chat-header-git__menu-row-main'>
          <span className='chat-header-git__row-icon material-symbols-rounded'>settings_suggest</span>
          <span className='chat-header-git__menu-row-title'>
            {t('chat.sessionWorkspaceEnvironmentDefault')}
          </span>
        </span>
      </button>

      {hasEnvironments
        ? environments.map((environment) => {
          const environmentReference = toEnvironmentReference(environment)
          const isActive = environmentReference === value || environment.id === value
          return (
            <button
              type='button'
              key={`${environment.source}:${environment.id}`}
              className={`chat-header-git__menu-row ${isActive ? 'is-active' : ''}`}
              disabled={disabled}
              title={environment.path}
              onClick={() => onChange(environmentReference)}
            >
              <span className='chat-header-git__menu-row-main'>
                <span className='chat-header-git__row-icon material-symbols-rounded'>
                  {environment.isLocal ? 'person' : 'folder'}
                </span>
                <span className='chat-header-git__menu-row-title'>
                  {toDisplayEnvironmentName(environment.id)}
                </span>
              </span>
              <span className='chat-header-git__menu-row-trailing'>
                <span className='chat-header-git__menu-row-value'>
                  {environment.isLocal
                    ? t('chat.sessionWorkspaceEnvironmentLocal')
                    : t('chat.sessionWorkspaceEnvironmentProject')}
                </span>
              </span>
            </button>
          )
        })
        : (
          <div className='chat-header-git__empty chat-header-git__empty--environment'>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('chat.sessionWorkspaceNoEnvironments')}
            />
          </div>
        )}
    </div>
  ), [disabled, environments, hasEnvironments, onChange, t, value])

  return (
    <Dropdown
      placement={placement}
      trigger={['click']}
      dropdownRender={() => menuRows}
    >
      <Button
        type='text'
        disabled={disabled}
        className={`chat-header-git__trigger chat-header-git__trigger--environment ${compact ? 'is-compact' : ''}`
          .trim()}
        title={selectedEnvironment?.path ?? triggerLabel}
        aria-label={t('chat.sessionWorkspaceEnvironment')}
      >
        <span className='chat-header-git__trigger-main'>
          <span className='material-symbols-rounded'>deployed_code</span>
          <span className='chat-header-git__trigger-label'>{triggerLabel}</span>
        </span>
        <span className='chat-header-git__trigger-chevron material-symbols-rounded'>expand_more</span>
      </Button>
    </Dropdown>
  )
}
