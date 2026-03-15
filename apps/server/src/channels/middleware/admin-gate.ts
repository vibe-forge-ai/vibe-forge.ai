import type { ChannelMiddleware } from './@types'

export const adminGateMiddleware: ChannelMiddleware = async (ctx, next) => {
  // Already has a session — no gate needed
  if (ctx.sessionId) {
    await next()
    return
  }

  const admins = ctx.config?.access?.admins
  if (admins && admins.length > 0) {
    const senderId = ctx.inbound.senderId
    if (!senderId || !admins.includes(senderId)) {
      await ctx.reply('当前频道尚未初始化会话，请联系管理员发起对话。')
      return
    }
  }
  await next()
}
