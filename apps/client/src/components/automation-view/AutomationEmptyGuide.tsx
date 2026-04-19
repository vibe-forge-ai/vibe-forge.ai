import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface AutomationEmptyGuideProps {
  onSelectStarter: (prompt: string) => void
}

export function AutomationEmptyGuide({ onSelectStarter }: AutomationEmptyGuideProps) {
  const { t } = useTranslation()
  const starterItems = useMemo(() => [
    {
      icon: 'wb_sunny',
      title: t('automation.starterDailyTitle'),
      description: t('automation.starterDailyDescription'),
      prompt: t('automation.starterDailyPrompt')
    },
    {
      icon: 'bug_report',
      title: t('automation.starterHealthTitle'),
      description: t('automation.starterHealthDescription'),
      prompt: t('automation.starterHealthPrompt')
    },
    {
      icon: 'summarize',
      title: t('automation.starterWeeklyTitle'),
      description: t('automation.starterWeeklyDescription'),
      prompt: t('automation.starterWeeklyPrompt')
    },
    {
      icon: 'notifications_active',
      title: t('automation.starterReminderTitle'),
      description: t('automation.starterReminderDescription'),
      prompt: t('automation.starterReminderPrompt')
    }
  ], [t])

  return (
    <div className='automation-empty-guide'>
      <div className='automation-empty-guide__header'>
        <div className='automation-empty-guide__eyebrow'>{t('automation.emptyLandingEyebrow')}</div>
        <h2>{t('automation.emptyLandingTitle')}</h2>
        <p>{t('automation.emptyLandingDescription')}</p>
      </div>
      <div className='automation-empty-guide__grid'>
        {starterItems.map(item => (
          <button
            key={item.title}
            type='button'
            className='automation-empty-guide__item'
            onClick={() => onSelectStarter(item.prompt)}
          >
            <span className='material-symbols-rounded automation-empty-guide__icon'>{item.icon}</span>
            <span className='automation-empty-guide__item-text'>
              <span className='automation-empty-guide__item-title'>{item.title}</span>
              <span className='automation-empty-guide__item-desc'>{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
