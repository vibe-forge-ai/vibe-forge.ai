import './NewSessionGuide.scss'

import { useAtom } from 'jotai'
import useSWR from 'swr'

import { MarkdownContent } from '#~/components/MarkdownContent'
import { showAnnouncementsAtom } from '#~/store/index.js'

export function NewSessionGuide() {
  const [showAnnouncements, setShowAnnouncements] = useAtom(showAnnouncementsAtom)

  const { data: configRes } = useSWR<{
    sources: {
      merged: {
        general?: {
          announcements: string[]
        }
      }
    }
  }>(
    '/api/config'
  )

  const { announcements = [] } = configRes?.sources.merged?.general ?? {}

  if (!showAnnouncements || announcements.length === 0) {
    return null
  }

  return (
    <div className='new-session-guide'>
      <div className='new-session-guide__announcements'>
        <div className='new-session-guide__announcements-list'>
          {announcements.map((item, index) => (
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
    </div>
  )
}
