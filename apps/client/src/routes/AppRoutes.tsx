import { Route, Routes } from 'react-router-dom'

import { ArchiveRoute } from '#~/routes/ArchiveRoute'
import { AutomationRoute } from '#~/routes/AutomationRoute'
import { BenchmarkRoute } from '#~/routes/BenchmarkRoute'
import { ChatRoute } from '#~/routes/ChatRoute'
import { ConfigRoute } from '#~/routes/ConfigRoute'
import { KnowledgeRoute } from '#~/routes/KnowledgeRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<ChatRoute />} />
      <Route path='/session/:sessionId' element={<ChatRoute />} />
      <Route path='/archive' element={<ArchiveRoute />} />
      <Route path='/benchmark' element={<BenchmarkRoute />} />
      <Route path='/automation' element={<AutomationRoute />} />
      <Route path='/knowledge' element={<KnowledgeRoute />} />
      <Route path='/config' element={<ConfigRoute />} />
    </Routes>
  )
}
