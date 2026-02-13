import { cwd as processCwd, env as processEnv } from 'node:process'

import type { Config, Session, SessionStatus } from '@vibe-forge/core'
import { loadConfig, systemController } from '@vibe-forge/core'

import { mergeRecord } from './utils'

export const getMergedGeneralConfig = async () => {
  const workspaceFolder = processEnv.__VF_PROJECT_WORKSPACE_FOLDER__ ?? processCwd()
  const jsonVariables: Record<string, string | null | undefined> = {
    ...processEnv,
    WORKSPACE_FOLDER: workspaceFolder,
    __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder
  }
  const [projectConfig, userConfig] = await loadConfig({ jsonVariables })
  return {
    interfaceLanguage: userConfig?.interfaceLanguage ?? projectConfig?.interfaceLanguage,
    modelLanguage: userConfig?.modelLanguage ?? projectConfig?.modelLanguage,
    notifications: mergeRecord(
      projectConfig?.notifications as Record<string, unknown> | undefined,
      userConfig?.notifications as Record<string, unknown> | undefined
    ) as Config['notifications']
  }
}

const resolveNotificationText = (
  status: SessionStatus,
  session: Session,
  language: Config['interfaceLanguage']
) => {
  const sessionLabel = session.title && session.title.trim() !== '' ? session.title : session.id
  if (language === 'en') {
    if (status === 'completed') return { title: 'Session completed', description: `Session "${sessionLabel}" completed.` }
    if (status === 'failed') return { title: 'Session failed', description: `Session "${sessionLabel}" failed.` }
    if (status === 'terminated') return { title: 'Session terminated', description: `Session "${sessionLabel}" terminated.` }
    return { title: 'Session needs input', description: `Session "${sessionLabel}" is waiting for input.` }
  }
  if (status === 'completed') return { title: '会话已完成', description: `会话「${sessionLabel}」已完成。` }
  if (status === 'failed') return { title: '会话失败', description: `会话「${sessionLabel}」失败。` }
  if (status === 'terminated') return { title: '会话已终止', description: `会话「${sessionLabel}」已终止。` }
  return { title: '会话等待输入', description: `会话「${sessionLabel}」正在等待输入。` }
}

export const maybeNotifySession = async (
  previousStatus: SessionStatus | undefined,
  nextStatus: SessionStatus | undefined,
  session: Session
) => {
  if (nextStatus == null || nextStatus === previousStatus) return
  const { notifications, interfaceLanguage } = await getMergedGeneralConfig()
  if (notifications?.disabled === true) return
  const eventConfig = notifications?.events?.[nextStatus]
  if (eventConfig?.disabled === true) return
  const fallbackText = resolveNotificationText(nextStatus, session, interfaceLanguage)
  const title = eventConfig?.title && eventConfig.title.trim() !== ''
    ? eventConfig.title
    : fallbackText.title
  const description = eventConfig?.description && eventConfig.description.trim() !== ''
    ? eventConfig.description
    : fallbackText.description
  const sound = eventConfig?.sound
  const resolvedSound = typeof sound === 'string' && sound.trim() !== '' ? sound.trim() : undefined
  await systemController.notify({
    title,
    description,
    sound: resolvedSound,
    volume: notifications.volume,
    timeout: false
  })
}
