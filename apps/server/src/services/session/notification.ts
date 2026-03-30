import type { Session, SessionStatus } from '@vibe-forge/core'
import type { Config, NotificationTrigger } from '@vibe-forge/types'
import { notify } from '@vibe-forge/utils/system'

import { loadConfigState } from '#~/services/config/index.js'

const toNotificationTrigger = (status: SessionStatus): NotificationTrigger | undefined => {
  if (status === 'completed' || status === 'failed' || status === 'terminated' || status === 'waiting_input') {
    return status
  }
  return undefined
}

const resolveNotificationText = (
  status: SessionStatus,
  session: Session,
  language: Config['interfaceLanguage']
) => {
  const sessionLabel = session.title && session.title.trim() !== '' ? session.title : session.id
  if (language === 'en') {
    if (status === 'completed') {
      return { title: 'Session completed', description: `Session "${sessionLabel}" completed.` }
    }
    if (status === 'failed') return { title: 'Session failed', description: `Session "${sessionLabel}" failed.` }
    if (status === 'terminated') {
      return { title: 'Session terminated', description: `Session "${sessionLabel}" terminated.` }
    }
    return { title: 'Session needs input', description: `Session "${sessionLabel}" is waiting for input.` }
  }
  if (status === 'completed') return { title: '会话已完成', description: `会话「${sessionLabel}」已完成。` }
  if (status === 'failed') return { title: '会话失败', description: `会话「${sessionLabel}」失败。` }
  if (status === 'terminated') return { title: '会话已终止', description: `会话「${sessionLabel}」已终止。` }
  return { title: '会话等待输入', description: `会话「${sessionLabel}」正在等待输入。` }
}

export async function maybeNotifySession(
  previousStatus: SessionStatus | undefined,
  nextStatus: SessionStatus | undefined,
  session: Session
) {
  if (nextStatus == null || nextStatus === previousStatus) return

  const notificationTrigger = toNotificationTrigger(nextStatus)
  if (notificationTrigger == null) return

  const { mergedConfig } = await loadConfigState()
  const { notifications, interfaceLanguage } = mergedConfig

  if (notifications?.disabled === true) return

  const eventConfig = notifications?.events?.[notificationTrigger]
  if (eventConfig?.disabled === true) return

  const fallbackText = resolveNotificationText(notificationTrigger, session, interfaceLanguage)
  const title = eventConfig?.title && eventConfig.title.trim() !== ''
    ? eventConfig.title
    : fallbackText.title
  const description = eventConfig?.description && eventConfig.description.trim() !== ''
    ? eventConfig.description
    : fallbackText.description
  const sound = eventConfig?.sound
  const resolvedSound = typeof sound === 'string' && sound.trim() !== '' ? sound.trim() : undefined

  await notify({
    title,
    description,
    sound: resolvedSound,
    volume: notifications?.volume,
    timeout: false
  })
}
