import { ConfigProvider } from 'antd'

import { AppShell } from '#~/components/layout/AppShell'
import { useSessionSubscription } from '#~/hooks/use-session-subscription.js'
import { useAppPreferences } from '#~/hooks/use-app-preferences'
import { useSidebarNavigation } from '#~/hooks/use-sidebar-navigation'
import { AppRoutes } from '#~/routes/AppRoutes'

export default function App() {
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
