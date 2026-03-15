import type { ChannelBaseConfig, ChannelInboundEvent } from '@vibe-forge/core/channel'

export const buildChannelContextPrompt = (
  inbound: ChannelInboundEvent,
  config: ChannelBaseConfig | undefined
): string | undefined => {
  const lines: string[] = []

  // Channel platform context
  const channelLabel = inbound.channelType === 'lark' ? '飞书（Lark）' : inbound.channelType
  lines.push(`你正在通过 ${channelLabel} 频道进行对话。`)

  // Bot's display name on this channel
  const botName = config?.title
  if (botName) {
    lines.push(`你在此频道上的名字是「${botName}」。`)
  }

  // Admin identities
  const admins = config?.access?.admins
  if (admins && admins.length > 0) {
    lines.push(`以下用户 ID 是本频道的管理员：${admins.join('、')}。`)
  }

  return lines.join('\n')
}
