/* eslint-disable max-lines -- account management keeps list, detail, and action flows in one surface. */
import './AdapterAccountsManager.scss'

import { App, Button, Empty, Input, Popconfirm, Spin, Tooltip } from 'antd'
import { useMemo, useState } from 'react'
import useSWR from 'swr'

import type { AdapterAccountActionDescriptor, AdapterAccountInfo, ConfigUiObjectSchema } from '@vibe-forge/types'

import { getAdapterAccountDetail, getAdapterAccounts, getApiErrorMessage, manageAdapterAccount } from '#~/api'

import { getFieldDescription, getFieldLabel, getValueByPath, setValueByPath } from './configUtils'
import type { TranslationFn } from './configUtils'
import { SchemaObjectEditor } from './record-editors/SchemaObjectEditor'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const ACCOUNT_ACTION_ICON: Record<AdapterAccountActionDescriptor['key'], string> = {
  add: 'person_add',
  refresh: 'refresh',
  remove: 'delete'
}

const ACCOUNT_STATUS_ICON: Record<NonNullable<AdapterAccountInfo['status']>, string> = {
  ready: 'check_circle',
  missing: 'warning',
  error: 'error'
}

const getConfiguredAccounts = (value: Record<string, unknown>) => {
  const configured = getValueByPath(value, ['accounts'])
  return isRecord(configured) ? configured : {}
}

const getConfiguredAccountEntry = (value: Record<string, unknown>, accountKey: string) => {
  const configured = getConfiguredAccounts(value)[accountKey]
  return isRecord(configured) ? configured : {}
}

const setConfiguredAccountEntry = (
  value: Record<string, unknown>,
  accountKey: string,
  nextEntry: Record<string, unknown>
) => setValueByPath(value, ['accounts', accountKey], nextEntry) as Record<string, unknown>

const formatStatus = (status: AdapterAccountInfo['status'], t: TranslationFn) => {
  switch (status) {
    case 'missing':
      return {
        label: t('config.accounts.status.missing'),
        color: 'default' as const,
        icon: ACCOUNT_STATUS_ICON.missing
      }
    case 'error':
      return {
        label: t('config.accounts.status.error'),
        color: 'error' as const,
        icon: ACCOUNT_STATUS_ICON.error
      }
    case 'ready':
    default:
      return {
        label: t('config.accounts.status.ready'),
        color: 'success' as const,
        icon: ACCOUNT_STATUS_ICON.ready
      }
  }
}

const getActionLabel = (action: AdapterAccountActionDescriptor, t: TranslationFn) => (
  t(`config.accounts.actions.${action.key}.label`, { defaultValue: action.label })
)

const getActionDescription = (action: AdapterAccountActionDescriptor, t: TranslationFn) => (
  t(`config.accounts.actions.${action.key}.description`, {
    defaultValue: action.description ?? action.label
  })
)

const normalizeText = (value: string | undefined) => value?.trim().toLowerCase() ?? ''
const normalizeDisplayText = (value: string | undefined) => value?.trim() ?? ''

const dedupeDisplayTexts = (...values: Array<string | undefined>) => {
  const uniqueValues = new Set<string>()

  return values
    .map(normalizeDisplayText)
    .filter((value) => {
      if (value === '' || uniqueValues.has(value)) return false
      uniqueValues.add(value)
      return true
    })
}

const parsePercentMetricValue = (value: string | undefined) => {
  if (value == null) return undefined

  const normalized = value.trim()
  if (!normalized.endsWith('%')) return undefined

  const parsed = Number(normalized.slice(0, -1))
  if (!Number.isFinite(parsed)) return undefined

  return Math.min(100, Math.max(0, parsed))
}

const getPercentRingColor = (percent: number) => {
  if (percent >= 85) return 'var(--error-color, #ff4d4f)'
  if (percent >= 60) return 'var(--warning-color, #faad14)'
  return 'var(--success-color, #52c41a)'
}

const compareAccountInfo = (
  left: Pick<AdapterAccountInfo, 'key' | 'title' | 'status' | 'isDefault'>,
  right: Pick<AdapterAccountInfo, 'key' | 'title' | 'status' | 'isDefault'>
) => {
  if (left.isDefault === true && right.isDefault !== true) return -1
  if (right.isDefault === true && left.isDefault !== true) return 1

  if (left.status !== right.status) {
    if (left.status === 'ready') return -1
    if (right.status === 'ready') return 1
  }

  const titleOrder = normalizeText(left.title).localeCompare(normalizeText(right.title))
  if (titleOrder !== 0) return titleOrder

  return left.key.localeCompare(right.key)
}

const renderTooltipContent = (label: string, description?: string) => {
  const normalizedDescription = description?.trim()
  if (normalizedDescription == null || normalizedDescription === '' || normalizedDescription === label) {
    return label
  }

  return (
    <div className='adapter-account-manager__tooltip'>
      <div className='adapter-account-manager__tooltip-title'>{label}</div>
      <div className='adapter-account-manager__tooltip-description'>{normalizedDescription}</div>
    </div>
  )
}

const IconTag = ({
  color,
  icon,
  label,
  description
}: {
  color?: 'default' | 'success' | 'error'
  icon: string
  label: string
  description?: string
}) => {
  const colorStyle = color === 'success'
    ? {
      color: 'var(--success-color, #52c41a)'
    }
    : color === 'error'
    ? {
      color: 'var(--error-color, #ff4d4f)'
    }
    : undefined

  return (
    <Tooltip title={renderTooltipContent(label, description)}>
      <span className='adapter-account-manager__icon-tag' style={colorStyle} aria-label={label}>
        <span className='material-symbols-rounded' aria-hidden='true'>{icon}</span>
      </span>
    </Tooltip>
  )
}

const AccountActionButtons = ({
  actions,
  loadingAction,
  onRunAction,
  t
}: {
  actions: AdapterAccountActionDescriptor[]
  loadingAction?: string
  onRunAction: (action: AdapterAccountActionDescriptor) => Promise<void>
  t: TranslationFn
}) => {
  if (actions.length === 0) return null

  return (
    <div className='adapter-account-manager__actions'>
      {actions.map((action) => {
        const label = getActionLabel(action, t)
        const description = getActionDescription(action, t)
        const icon = ACCOUNT_ACTION_ICON[action.key]

        if (action.key === 'remove') {
          return (
            <Popconfirm
              key={action.key}
              title={t('config.accounts.deleteConfirmTitle', {
                defaultValue: 'Delete the stored snapshot for {{account}}?',
                account: label
              })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onConfirm={async () => {
                await onRunAction(action)
              }}
            >
              <Tooltip title={renderTooltipContent(label, description)}>
                <Button
                  type='default'
                  size='small'
                  danger
                  loading={loadingAction === action.key}
                  aria-label={label}
                  className='adapter-account-manager__icon-button adapter-account-manager__header-action'
                  icon={<span className='material-symbols-rounded'>{icon}</span>}
                />
              </Tooltip>
            </Popconfirm>
          )
        }

        return (
          <Tooltip key={action.key} title={renderTooltipContent(label, description)}>
            <Button
              type='default'
              size='small'
              loading={loadingAction === action.key}
              aria-label={label}
              className='adapter-account-manager__icon-button adapter-account-manager__header-action'
              icon={<span className='material-symbols-rounded'>{icon}</span>}
              onClick={async () => {
                await onRunAction(action)
              }}
            />
          </Tooltip>
        )
      })}
    </div>
  )
}

export const mergeAccounts = (
  configured: Record<string, unknown>,
  discovered: AdapterAccountInfo[],
  defaultAccountKey?: string
) => {
  const merged = new Map<string, AdapterAccountInfo>()

  Object.entries(configured).forEach(([key, entry]) => {
    const configuredEntry = isRecord(entry) ? entry : {}
    const title = typeof configuredEntry.title === 'string' ? configuredEntry.title.trim() : ''
    const description = typeof configuredEntry.description === 'string' ? configuredEntry.description.trim() : ''
    merged.set(key, {
      key,
      title: title !== '' ? title : key,
      ...(description !== '' ? { description } : {}),
      status: 'missing'
    })
  })

  discovered.forEach((account) => {
    const existing = merged.get(account.key)
    merged.set(account.key, {
      ...existing,
      ...account
    })
  })

  return [...merged.values()]
    .map(account => ({
      ...account,
      isDefault: defaultAccountKey != null && defaultAccountKey !== ''
        ? account.key === defaultAccountKey
        : account.isDefault
    }))
    .sort(compareAccountInfo)
}

const AccountEditor = ({
  adapterKey,
  accountKey,
  accountItemSchema,
  value,
  onChange,
  t
}: {
  adapterKey: string
  accountKey: string
  accountItemSchema?: ConfigUiObjectSchema
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
}) => {
  if (accountItemSchema == null || accountItemSchema.fields.length === 0) {
    return null
  }

  const editorSchema: ConfigUiObjectSchema = {
    ...accountItemSchema,
    fields: accountItemSchema.fields.map((field) => {
      if (field.path.length === 1 && field.path[0] === 'description') {
        return {
          ...field,
          type: 'multiline'
        }
      }

      return field
    })
  }
  const defaultAuthFilePath = `.ai/.local/adapters/${adapterKey}/accounts/${accountKey}/auth.json`

  return (
    <div className='adapter-account-manager__editor'>
      <div className='adapter-account-manager__section-title'>
        <span className='material-symbols-rounded'>tune</span>
        <span>{t('config.accounts.settingsTitle', { defaultValue: 'Account settings' })}</span>
      </div>
      <SchemaObjectEditor
        value={getConfiguredAccountEntry(value, accountKey)}
        schema={editorSchema}
        onChange={(nextEntry) => onChange(setConfiguredAccountEntry(value, accountKey, nextEntry))}
        t={t}
        resolveFieldLabel={(field, fallback) => getFieldLabel(t, 'adapterAccount', field.path, fallback)}
        resolveFieldDescription={(field, fallback) => {
          const translated = getFieldDescription(t, 'adapterAccount', field.path)
          const baseDescription = translated !== '' ? translated : fallback
          if (field.path.length === 1 && field.path[0] === 'authFile') {
            const defaultLookupHint = t('config.accounts.authFileDefaultLookup', {
              defaultValue: 'Leave empty to use {{path}}.',
              path: defaultAuthFilePath
            })

            return [baseDescription, defaultLookupHint]
              .map(item => item.trim())
              .filter(item => item !== '')
              .join(' ')
          }

          return baseDescription
        }}
      />
    </div>
  )
}

const AccountDetailView = ({
  adapterKey,
  accountKey,
  accountItemSchema,
  value,
  onChange,
  onChanged,
  onRemoved,
  t
}: {
  adapterKey: string
  accountKey: string
  accountItemSchema?: ConfigUiObjectSchema
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  onChanged: () => Promise<void>
  onRemoved: () => void
  t: TranslationFn
}) => {
  const { message } = App.useApp()
  const { data, isLoading, mutate } = useSWR(
    `/api/adapters/${adapterKey}/accounts/${accountKey}`,
    () => getAdapterAccountDetail(adapterKey, accountKey)
  )
  const [loadingAction, setLoadingAction] = useState<string>()
  const detail = data?.account
  const statusMeta = formatStatus(detail?.status, t)
  const detailActions = (detail?.actions ?? []).filter(action => action.key !== 'refresh')
  const quotaMetrics = detail?.quota?.metrics?.filter((metric) => {
    if (typeof metric.value === 'string') return metric.value.trim() !== ''
    return metric.value != null
  }) ?? []

  const handleRunAction = async (action: AdapterAccountActionDescriptor) => {
    setLoadingAction(action.key)
    try {
      const result = await manageAdapterAccount(adapterKey, {
        action: action.key,
        account: accountKey,
        refresh: action.key === 'refresh'
      })
      await onChanged()
      if (action.key === 'remove') {
        void message.success(result.message ?? t('config.accounts.actionSuccess.remove'))
        onRemoved()
        return
      }

      if (result.account != null) {
        await mutate({ account: result.account }, { revalidate: false })
      } else {
        const next = await getAdapterAccountDetail(adapterKey, accountKey, { refresh: true })
        await mutate(next, { revalidate: false })
      }
      void message.success(result.message ?? t(`config.accounts.actionSuccess.${action.key}`))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t(`config.accounts.actionFailed.${action.key}`)))
    } finally {
      setLoadingAction(undefined)
    }
  }

  return (
    <div className='adapter-account-manager__detail'>
      {isLoading && (
        <div className='adapter-account-manager__state'>
          <Spin size='small' />
        </div>
      )}

      {!isLoading && detail == null && (
        <Empty image={null} description={t('config.accounts.detailMissing')} />
      )}

      {detail != null && (
        <div className='adapter-account-manager__detail-body'>
          <div className='adapter-account-manager__hero'>
            <div className='adapter-account-manager__hero-body'>
              <div className='adapter-account-manager__hero-title-row'>
                <div className='adapter-account-manager__hero-title'>{detail.title}</div>
                <div className='adapter-account-manager__hero-meta'>
                  <div className='adapter-account-manager__hero-badges'>
                    <IconTag
                      color={statusMeta.color}
                      icon={statusMeta.icon}
                      label={statusMeta.label}
                    />
                    {detail.isDefault === true && (
                      <IconTag
                        icon='star'
                        label={t('config.accounts.default')}
                      />
                    )}
                  </div>
                  {detailActions.length > 0 && (
                    <AccountActionButtons
                      actions={detailActions}
                      loadingAction={loadingAction}
                      onRunAction={handleRunAction}
                      t={t}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {quotaMetrics.length > 0 && (
            <div className='adapter-account-manager__section'>
              <div className='adapter-account-manager__section-title'>
                <span className='material-symbols-rounded'>query_stats</span>
                <span>{t('config.accounts.quotaTitle', { defaultValue: 'Quota' })}</span>
              </div>
              <div className='adapter-account-manager__metrics'>
                {quotaMetrics.map(metric => (
                  <div key={metric.id} className='adapter-account-manager__metric'>
                    <div className='adapter-account-manager__metric-label'>
                      {metric.label}
                    </div>
                    <div className='adapter-account-manager__metric-value'>
                      {metric.value ?? '-'}
                      {(() => {
                        const percent = parsePercentMetricValue(metric.value)
                        if (percent == null) return null

                        return (
                          <span
                            className='adapter-account-manager__metric-ring'
                            aria-hidden='true'
                            style={{
                              background: `conic-gradient(${
                                getPercentRingColor(percent)
                              } ${percent}%, color-mix(in srgb, var(--border-color) 72%, transparent) 0)`
                            }}
                          >
                            <span className='adapter-account-manager__metric-ring-inner' />
                          </span>
                        )
                      })()}
                    </div>
                    {metric.description != null && metric.description.trim() !== '' && (
                      <div className='adapter-account-manager__metric-description'>{metric.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <AccountEditor
            adapterKey={adapterKey}
            accountKey={accountKey}
            accountItemSchema={accountItemSchema}
            value={value}
            onChange={onChange}
            t={t}
          />
        </div>
      )}
    </div>
  )
}

const AccountsOverviewCard = ({
  accounts,
  onOpenAccounts,
  t
}: {
  accounts: AdapterAccountInfo[]
  onOpenAccounts: () => void
  t: TranslationFn
}) => {
  const readyCount = accounts.filter(account => account.status !== 'missing' && account.status !== 'error').length
  const defaultAccount = accounts.find(account => account.isDefault === true)

  return (
    <div className='adapter-account-manager__overview'>
      <button
        type='button'
        className='adapter-account-manager__overview-card config-view__field-row'
        onClick={onOpenAccounts}
      >
        <div className='config-view__field-meta'>
          <span className='material-symbols-rounded config-view__field-icon'>manage_accounts</span>
          <div className='config-view__field-text'>
            <div className='config-view__field-title'>{t('config.accounts.title')}</div>
            <div className='config-view__field-desc adapter-account-manager__overview-meta'>
              <span>{t('config.accounts.count', { count: accounts.length })}</span>
              <span>{t('config.accounts.readyCount', { count: readyCount })}</span>
              {defaultAccount != null && (
                <span>{t('config.accounts.defaultHint', { account: defaultAccount.title })}</span>
              )}
            </div>
          </div>
        </div>
        <div className='config-view__field-control adapter-account-manager__overview-control'>
          <span className='material-symbols-rounded adapter-account-manager__overview-arrow'>chevron_right</span>
        </div>
      </button>
    </div>
  )
}

const AccountsListView = ({
  accounts,
  actions,
  loadingAction,
  onOpenAccount,
  onRunAction,
  currentDefaultAccount,
  deletingAccountKey,
  onToggleDefaultAccount,
  onDeleteAccount,
  t
}: {
  accounts: AdapterAccountInfo[]
  actions: AdapterAccountActionDescriptor[]
  loadingAction?: string
  onOpenAccount: (accountKey: string) => void
  onRunAction: (action: AdapterAccountActionDescriptor) => void
  currentDefaultAccount?: string
  deletingAccountKey?: string
  onToggleDefaultAccount: (accountKey: string) => void
  onDeleteAccount: (accountKey: string) => Promise<void>
  t: TranslationFn
}) => {
  const [searchValue, setSearchValue] = useState('')
  const normalizedSearch = normalizeText(searchValue)
  const addAction = actions.find(action => action.key === 'add')
  const filteredAccounts = useMemo(() => {
    if (normalizedSearch === '') return accounts
    return accounts.filter(account => {
      const haystacks = [
        account.title,
        account.key,
        account.description,
        account.quota?.summary
      ]
      return haystacks.some(value => normalizeText(value).includes(normalizedSearch))
    })
  }, [accounts, normalizedSearch])

  return (
    <div className='adapter-account-manager'>
      <div className='adapter-account-manager__header'>
        <Input
          allowClear
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          className='adapter-account-manager__search'
          placeholder={t('config.accounts.searchPlaceholder', { defaultValue: 'Search accounts' })}
          prefix={<span className='material-symbols-rounded'>search</span>}
        />
        {addAction != null && (
          <Tooltip
            title={renderTooltipContent(getActionLabel(addAction, t), getActionDescription(addAction, t))}
          >
            <Button
              size='small'
              type='default'
              loading={loadingAction === addAction.key}
              aria-label={getActionLabel(addAction, t)}
              className='adapter-account-manager__icon-button adapter-account-manager__header-action'
              icon={<span className='material-symbols-rounded'>{ACCOUNT_ACTION_ICON[addAction.key]}</span>}
              onClick={() => onRunAction(addAction)}
            />
          </Tooltip>
        )}
      </div>

      {filteredAccounts.length === 0 && (
        <Empty
          image={null}
          description={accounts.length === 0
            ? t('config.accounts.empty')
            : t('config.accounts.searchEmpty', { defaultValue: 'No matching accounts' })}
        />
      )}

      {filteredAccounts.length > 0 && (
        <div className='adapter-account-manager__list'>
          {filteredAccounts.map((account) => {
            const isDefault = currentDefaultAccount === account.key || account.isDefault === true
            const showDeleteAction = account.status !== 'missing'

            return (
              <div key={account.key} className='adapter-account-manager__item'>
                <button
                  type='button'
                  className='adapter-account-manager__item-trigger'
                  onClick={() => onOpenAccount(account.key)}
                >
                  <div className='adapter-account-manager__item-main'>
                    <div className='adapter-account-manager__item-title'>{account.title}</div>
                    {account.quota?.summary != null && account.quota.summary !== '' && (
                      <div className='adapter-account-manager__item-description'>
                        <span className='material-symbols-rounded'>speed</span>
                        <span>{account.quota.summary}</span>
                      </div>
                    )}
                  </div>
                </button>
                <div className='adapter-account-manager__item-actions'>
                  <Tooltip
                    title={isDefault
                      ? t('config.accounts.rowActions.clearDefault', { defaultValue: 'Clear default account' })
                      : t('config.accounts.rowActions.setDefault', { defaultValue: 'Set as default account' })}
                  >
                    <Button
                      type='text'
                      size='small'
                      aria-label={isDefault
                        ? t('config.accounts.rowActions.clearDefault', { defaultValue: 'Clear default account' })
                        : t('config.accounts.rowActions.setDefault', { defaultValue: 'Set as default account' })}
                      className={`adapter-account-manager__row-action ${
                        isDefault ? 'adapter-account-manager__row-action--active' : ''
                      }`}
                      icon={<span className='material-symbols-rounded'>star</span>}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleDefaultAccount(account.key)
                      }}
                    />
                  </Tooltip>
                  {showDeleteAction && (
                    <Popconfirm
                      title={t('config.accounts.deleteConfirmTitle', {
                        defaultValue: 'Delete the stored snapshot for {{account}}?',
                        account: account.title
                      })}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      onConfirm={async (event) => {
                        event?.stopPropagation?.()
                        await onDeleteAccount(account.key)
                      }}
                    >
                      <Button
                        type='text'
                        size='small'
                        danger
                        loading={deletingAccountKey === account.key}
                        aria-label={t('config.accounts.rowActions.delete', { defaultValue: 'Delete account snapshot' })}
                        className='adapter-account-manager__row-action'
                        icon={<span className='material-symbols-rounded'>delete</span>}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const AdapterAccountsManager = ({
  adapterKey,
  value,
  accountItemSchema,
  nestedPath = [],
  onChange,
  onOpenNestedPath,
  t
}: {
  adapterKey: string
  value: Record<string, unknown>
  accountItemSchema?: ConfigUiObjectSchema
  nestedPath?: string[]
  onChange: (nextValue: Record<string, unknown>) => void
  onOpenNestedPath: (nextPath: string[]) => void
  t: TranslationFn
}) => {
  const { message } = App.useApp()
  const configuredDefaultAccount = typeof value.defaultAccount === 'string' && value.defaultAccount.trim() !== ''
    ? value.defaultAccount.trim()
    : undefined
  const { data, isLoading, mutate } = useSWR(
    `/api/adapters/${adapterKey}/accounts`,
    () => getAdapterAccounts(adapterKey)
  )
  const [loadingAction, setLoadingAction] = useState<string>()
  const [deletingAccountKey, setDeletingAccountKey] = useState<string>()
  const configuredAccounts = useMemo(() => getConfiguredAccounts(value), [value])
  const accounts = useMemo(
    () => mergeAccounts(configuredAccounts, data?.accounts ?? [], configuredDefaultAccount),
    [configuredAccounts, configuredDefaultAccount, data?.accounts]
  )
  const actionDescriptors = data?.actions ?? []
  const isAccountsView = nestedPath[0] === 'accounts'
  const activeAccountKey = isAccountsView ? nestedPath[1] : undefined

  const refreshAccounts = async () => {
    await mutate()
  }

  const handleToggleDefaultAccount = (accountKey: string) => {
    const nextValue = { ...value }
    if (configuredDefaultAccount === accountKey) {
      delete nextValue.defaultAccount
    } else {
      nextValue.defaultAccount = accountKey
    }
    onChange(nextValue)
  }

  const handleRunListAction = async (action: AdapterAccountActionDescriptor) => {
    if (action.key !== 'add') return

    setLoadingAction(action.key)
    try {
      const result = await manageAdapterAccount(adapterKey, { action: 'add' })
      await refreshAccounts()
      void message.success(result.message ?? t('config.accounts.actionSuccess.add'))
      if (result.accountKey != null && result.accountKey.trim() !== '') {
        onOpenNestedPath(['accounts', result.accountKey])
      } else {
        onOpenNestedPath(['accounts'])
      }
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('config.accounts.actionFailed.add')))
    } finally {
      setLoadingAction(undefined)
    }
  }

  const handleDeleteAccount = async (accountKey: string) => {
    setDeletingAccountKey(accountKey)
    try {
      const result = await manageAdapterAccount(adapterKey, {
        action: 'remove',
        account: accountKey,
        refresh: true
      })
      await refreshAccounts()
      void message.success(result.message ?? t('config.accounts.actionSuccess.remove'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('config.accounts.actionFailed.remove')))
    } finally {
      setDeletingAccountKey(undefined)
    }
  }

  if (isLoading && accounts.length === 0) {
    return (
      <div className='adapter-account-manager__state'>
        <Spin size='small' />
      </div>
    )
  }

  if (isAccountsView && activeAccountKey != null && activeAccountKey !== '') {
    return (
      <AccountDetailView
        adapterKey={adapterKey}
        accountKey={activeAccountKey}
        accountItemSchema={accountItemSchema}
        value={value}
        onChange={onChange}
        onChanged={refreshAccounts}
        onRemoved={() => onOpenNestedPath(['accounts'])}
        t={t}
      />
    )
  }

  if (isAccountsView) {
    return (
      <AccountsListView
        accounts={accounts}
        actions={actionDescriptors}
        loadingAction={loadingAction}
        onOpenAccount={(accountKey) => onOpenNestedPath(['accounts', accountKey])}
        onRunAction={handleRunListAction}
        currentDefaultAccount={configuredDefaultAccount}
        deletingAccountKey={deletingAccountKey}
        onToggleDefaultAccount={handleToggleDefaultAccount}
        onDeleteAccount={handleDeleteAccount}
        t={t}
      />
    )
  }

  return (
    <AccountsOverviewCard
      accounts={accounts}
      onOpenAccounts={() => onOpenNestedPath(['accounts'])}
      t={t}
    />
  )
}
