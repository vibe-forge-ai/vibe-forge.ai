import { getDb } from '#~/db/index.js'

import { deleteBinding } from '../state'
import type { ChannelMiddleware } from './@types'

export const channelCommandMiddleware: ChannelMiddleware = async (ctx, next) => {
  const { inbound, config, reply } = ctx
  const command = ctx.commandText.split(/\s+/)[0]
  const admins = config?.access?.admins

  if (command === '/help') {
    await inbound.ack?.().catch(() => undefined)
    await reply('支持的指令：\n- /reset：清空会话绑定\n- /help：查看指令列表')
    await inbound.unack?.().catch(() => undefined)
    return
  }

  if (command === '/reset') {
    await inbound.ack?.().catch(() => undefined)
    // Admin gate: only admins can reset when admins are configured
    if (admins && admins.length > 0) {
      const senderId = inbound.senderId
      if (!senderId || !admins.includes(senderId)) {
        await reply('您没有权限执行该操作，只有管理员才能重置会话。')
        await inbound.unack?.().catch(() => undefined)
        return
      }
    }
    const { sessionId } = ctx
    if (sessionId) {
      getDb().deleteChannelSessionBySessionId(sessionId)
      deleteBinding(sessionId)
      ctx.sessionId = undefined
    }
    await reply('已重置会话，可以继续对话。')
    await inbound.unack?.().catch(() => undefined)
    return
  }

  // Not a command — continue the chain
  await next()
}
