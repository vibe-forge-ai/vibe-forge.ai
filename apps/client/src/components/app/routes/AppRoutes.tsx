import { Route, Routes } from 'react-router-dom'

import { ArchiveView } from '#~/components/ArchiveView'
import { AutomationView } from '#~/components/AutomationView'
import { BenchmarkView } from '#~/components/BenchmarkView'
import { Chat } from '#~/components/Chat'
import { ConfigView } from '#~/components/ConfigView'
import { KnowledgeBaseView } from '#~/components/knowledge-base'
import { SessionRoute } from '#~/components/app/routes/SessionRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<Chat />} />
      <Route path='/session/:sessionId' element={<SessionRoute />} />
      <Route path='/archive' element={<ArchiveView />} />
      <Route path='/benchmark' element={<BenchmarkView />} />
      <Route path='/automation' element={<AutomationView />} />
      <Route path='/knowledge' element={<KnowledgeBaseView />} />
      <Route path='/config' element={<ConfigView />} />
    </Routes>
  )
}
