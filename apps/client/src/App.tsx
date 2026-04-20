import { ConfigProvider } from 'antd'

import { AuthGate } from '#~/components/auth/AuthGate'
import { AppShell } from '#~/components/layout/AppShell'
import { ServerConnectionGate } from '#~/components/server-connection/ServerConnectionGate'
import { useAppPreferences } from '#~/hooks/use-app-preferences'
import { useMdpBrowserRuntime } from '#~/hooks/use-mdp-browser-runtime'
import { useSessionSubscription } from '#~/hooks/use-session-subscription.js'
import { useSidebarNavigation } from '#~/hooks/use-sidebar-navigation'
import { AppRoutes } from '#~/routes/AppRoutes'

function AuthenticatedApp() {
  useSessionSubscription()
  useMdpBrowserRuntime()
  const { isDarkMode, themeConfig } = useAppPreferences()
  const sidebarNavigation = useSidebarNavigation()

  return (
    <ConfigProvider theme={themeConfig}>
      <AppShell
        activeSessionId={sidebarNavigation.activeSessionId}
        isDarkMode={isDarkMode}
        onDeletedSession={sidebarNavigation.handleDeletedSession}
        onSelectSession={sidebarNavigation.handleSelectSession}
        showSidebar={sidebarNavigation.showSidebar}
        sidebarWidth={sidebarNavigation.sidebarWidth}
      >
        <AppRoutes />
      </AppShell>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <ServerConnectionGate>
      <AuthGate>
        <AuthenticatedApp />
      </AuthGate>
    </ServerConnectionGate>
  )
}
