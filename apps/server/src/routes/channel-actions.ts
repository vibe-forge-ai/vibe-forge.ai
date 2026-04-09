import Router from '@koa/router'

import { consumeChannelActionToken, verifyChannelActionToken } from '#~/channels/action-token.js'
import { resolveToolCallPayload } from '#~/channels/tool-call-file.js'
import { sendChannelToolCallJsonFile } from '#~/channels/index.js'
import {
  renderActionPage,
  renderExportLaunchPage,
  renderToolCallDetailPage,
  resolveActionTokenErrorPage
} from './channel-actions-page.js'

const parseQueryString = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const parseBodyToken = (body: unknown) => {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return ''
  }
  const token = (body as { token?: unknown }).token
  return typeof token === 'string' ? token.trim() : ''
}

export function channelActionsRouter(): Router {
  const router = new Router()

  router.get('/tool-call-export', async (ctx) => {
    const verified = verifyChannelActionToken(parseQueryString(ctx.query.token), 'tool-call-export')
    if (!verified.ok) {
      const errorPage = resolveActionTokenErrorPage(verified.code)
      ctx.status = errorPage.status
      ctx.type = 'text/html'
      ctx.body = renderActionPage({
        ok: false,
        title: errorPage.title,
        message: errorPage.message
      })
      return
    }

    ctx.status = 200
    ctx.type = 'text/html'
    ctx.body = renderExportLaunchPage(parseQueryString(ctx.query.token))
  })

  router.post('/tool-call-export', async (ctx) => {
    const verified = consumeChannelActionToken(
      parseBodyToken(ctx.request.body) || parseQueryString(ctx.query.token),
      'tool-call-export'
    )
    if (!verified.ok) {
      const errorPage = resolveActionTokenErrorPage(verified.code)
      ctx.status = errorPage.status
      ctx.type = 'text/html'
      ctx.body = renderActionPage({
        ok: false,
        title: errorPage.title,
        message: errorPage.message
      })
      return
    }

    const result = await sendChannelToolCallJsonFile(
      verified.claims.sessionId,
      verified.claims.toolUseId ?? '',
      verified.claims.messageId
    )
    ctx.status = result.statusCode
    ctx.type = 'text/html'
    ctx.body = renderActionPage({
      ok: result.ok,
      title: result.ok ? '已请求发送完整 JSON 文件' : '发送完整 JSON 文件失败',
      message: result.message,
      detailUrl: result.detailUrl,
      fileName: result.fileName
    })
  })

  router.get('/tool-call-detail', async (ctx) => {
    const verified = verifyChannelActionToken(parseQueryString(ctx.query.token), 'tool-call-detail')
    if (!verified.ok) {
      const errorPage = resolveActionTokenErrorPage(verified.code)
      ctx.status = errorPage.status
      ctx.type = 'text/html'
      ctx.body = renderActionPage({
        ok: false,
        title: errorPage.title,
        message: errorPage.message
      })
      return
    }

    const sessionId = verified.claims.sessionId
    const toolUseId = verified.claims.toolUseId ?? ''
    const messageId = verified.claims.messageId
    const payload = resolveToolCallPayload(sessionId, toolUseId)
    if (payload == null) {
      ctx.status = 404
      ctx.type = 'text/html'
      ctx.body = renderActionPage({
        ok: false,
        title: '没有找到工具调用详情',
        message: '当前 session 里不存在这个 toolUseId 对应的历史记录。'
      })
      return
    }

    ctx.status = 200
    ctx.type = 'text/html'
    ctx.body = renderToolCallDetailPage({
      sessionId,
      toolUseId,
      messageId,
      payload
    })
  })

  return router
}
