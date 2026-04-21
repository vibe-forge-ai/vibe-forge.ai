import { App as AntdApp } from 'antd'
import type { MenuProps } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR, { useSWRConfig } from 'swr'

import { getAuthStatus, logout } from '#~/api/auth'
import { clearAuthToken } from '#~/api/auth-token'
import { getApiErrorMessage } from '#~/api/base'
import { isServerConnectionManagedClientMode, requestServerConnectionPicker } from '#~/runtime-config'

import type { NavRailCompactMoreAction } from './NavRailCompact'

export function useNavRailAccountActions() {
  const { t } = useTranslation()
  const { message } = AntdApp.useApp()
  const { mutate } = useSWRConfig()
  const { data: authStatus } = useSWR('/api/auth/status', getAuthStatus)
  const connectionManagedMode = isServerConnectionManagedClientMode()
  const authEnabled = authStatus?.enabled === true

  const refreshAuthStatus = React.useCallback(async () => {
    try {
      await mutate('/api/auth/status')
    } catch {
      // The user intent is still to leave the current local session.
    }
  }, [mutate])

  const handleChangeServer = React.useCallback(() => {
    requestServerConnectionPicker({ clearCurrentServer: true })
    window.location.reload()
  }, [])

  const handleLogout = React.useCallback(async () => {
    try {
      await logout()
      await refreshAuthStatus()
    } catch (err) {
      clearAuthToken()
      await refreshAuthStatus()
      void message.error(getApiErrorMessage(err, t('auth.logoutFailed')))
    }
  }, [message, refreshAuthStatus, t])

  const accountItems = React.useMemo<NonNullable<MenuProps['items']>>(() => {
    const items: NonNullable<MenuProps['items']> = []

    if (connectionManagedMode) {
      items.push({
        key: 'change-server',
        label: t('auth.changeServer'),
        icon: <span className='material-symbols-rounded nav-menu-icon'>sync_alt</span>,
        onClick: handleChangeServer
      })
    }

    if (authEnabled) {
      if (items.length > 0) {
        items.push({ key: 'account-divider', type: 'divider' })
      }

      items.push({
        key: 'logout',
        label: t('auth.logout'),
        danger: true,
        icon: <span className='material-symbols-rounded nav-menu-icon'>logout</span>,
        onClick: () => {
          void handleLogout()
        }
      })
    }

    return items
  }, [authEnabled, connectionManagedMode, handleChangeServer, handleLogout, t])

  const compactAccountActions = React.useMemo<NavRailCompactMoreAction[]>(() => [
    ...(connectionManagedMode
      ? [{
        icon: 'sync_alt',
        key: 'change-server',
        label: t('auth.changeServer'),
        onSelect: handleChangeServer
      }]
      : []),
    ...(authEnabled
      ? [{
        icon: 'logout',
        key: 'logout',
        label: t('auth.logout'),
        onSelect: () => {
          void handleLogout()
        }
      }]
      : [])
  ], [authEnabled, connectionManagedMode, handleChangeServer, handleLogout, t])

  return {
    accountItems,
    accountMenuLabel: t('auth.accountMenu'),
    compactAccountActions,
    showAccountMenu: accountItems.length > 0
  }
}
