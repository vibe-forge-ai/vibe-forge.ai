import './NewSessionGuide.scss'

import { useAtom, useAtomValue } from 'jotai'

import type { ConversationStarterConfig } from '@vibe-forge/types'

import { MarkdownContent } from '#~/components/MarkdownContent'
import { showAnnouncementsAtom, showNewSessionStarterListAtom } from '#~/store/index.js'

import { NewSessionGuideStarterList } from './NewSessionGuideStarterList'

export function NewSessionGuide({
  announcements,
  startupPresets,
  builtinActions,
  onApplyStarter
}: {
  announcements: string[]
  startupPresets: ConversationStarterConfig[]
  builtinActions: ConversationStarterConfig[]
  onApplyStarter: (starter: ConversationStarterConfig) => void
}) {
  const [showAnnouncements, setShowAnnouncements] = useAtom(showAnnouncementsAtom)
  const showNewSessionStarterList = useAtomValue(showNewSessionStarterListAtom)
  const visibleAnnouncements = showAnnouncements ? announcements : []
  const visibleStartupPresets = showNewSessionStarterList ? startupPresets : []
  const visibleBuiltinActions = showNewSessionStarterList ? builtinActions : []
  const hasStarterList = visibleStartupPresets.length > 0 || visibleBuiltinActions.length > 0
  const hasGuideContent = visibleAnnouncements.length > 0 || hasStarterList

  if (!hasGuideContent) {
    return null
  }

  return (
    <div className='new-session-guide'>
      {visibleAnnouncements.length > 0 && (
        <div className='new-session-guide__announcements'>
          <div className='new-session-guide__announcements-list'>
            {visibleAnnouncements.map((item, index) => (
              <div key={`${item}-${index}`} className='new-session-guide__announcements-item'>
                <span className='material-symbols-rounded new-session-guide__announcements-icon'>campaign</span>
                <div className='new-session-guide__announcements-copy'>
                  <MarkdownContent content={item} />
                </div>
              </div>
            ))}
          </div>
          <button
            type='button'
            className='new-session-guide__announcements-close'
            onClick={() => setShowAnnouncements(false)}
          >
            <span className='material-symbols-rounded'>close</span>
          </button>
        </div>
      )}
      {hasStarterList && (
        <div className='new-session-guide__main'>
          <NewSessionGuideStarterList
            startupPresets={visibleStartupPresets}
            builtinActions={visibleBuiltinActions}
            onApplyStarter={onApplyStarter}
          />
        </div>
      )}
    </div>
  )
}
