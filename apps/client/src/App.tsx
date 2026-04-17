import { ConfigProvider } from 'antd'

import { AuthGate } from '#~/components/auth/AuthGate'
import { AppShell } from '#~/components/layout/AppShell'
import { useAppPreferences } from '#~/hooks/use-app-preferences'
import { useSessionSubscription } from '#~/hooks/use-session-subscription.js'
import { useSidebarNavigation } from '#~/hooks/use-sidebar-navigation'
import { AppRoutes } from '#~/routes/AppRoutes'

function AuthenticatedApp() {
  useSessionSubscription()
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
    <AuthGate>
      <AuthenticatedApp />
    </AuthGate>
  )
}
