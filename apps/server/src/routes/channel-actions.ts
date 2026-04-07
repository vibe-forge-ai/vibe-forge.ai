import Router from '@koa/router'

import { resolveToolCallPayload } from '#~/channels/tool-call-file.js'
import { sendChannelToolCallJsonFile } from '#~/channels/index.js'
import { normalizeToolDisplayName } from '#~/channels/tool-call-name.js'

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')

const renderActionPage = (input: {
  title: string
  message: string
  detailUrl?: string
  fileName?: string
  ok: boolean
}) => {
  const title = escapeHtml(input.title)
  const message = escapeHtml(input.message)
  const fileName = input.fileName == null ? '' : `<p><strong>文件名</strong>: ${escapeHtml(input.fileName)}</p>`
  const detailLink = input.detailUrl == null
    ? ''
    : `<p><a href="${escapeHtml(input.detailUrl)}" target="_blank" rel="noreferrer">打开工具调用详情</a></p>`
  const statusColor = input.ok ? '#166534' : '#991b1b'
  const statusLabel = input.ok ? '已完成' : '执行失败'

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<style>',
    'body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7fb;color:#0f172a;}',
    '.wrap{max-width:720px;margin:48px auto;padding:0 20px;}',
    '.card{background:#fff;border:1px solid #dbe2f0;border-radius:16px;padding:24px;box-shadow:0 12px 40px rgba(15,23,42,.08);}',
    '.status{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:600;background:#eef2ff;color:#3730a3;}',
    `h1{margin:16px 0 12px;font-size:24px;line-height:1.3;color:${statusColor};}`,
    'p{margin:12px 0;line-height:1.7;}',
    'a{color:#2563eb;text-decoration:none;}',
    'a:hover{text-decoration:underline;}',
    '.hint{margin-top:20px;color:#475569;font-size:14px;}',
    '</style>',
    '</head>',
    '<body>',
    '<main class="wrap">',
    '<section class="card">',
    `<div class="status">${statusLabel}</div>`,
    `<h1>${title}</h1>`,
    `<p>${message}</p>`,
    fileName,
    detailLink,
    '<p class="hint">这个页面只是 server 动作结果页。机器人回传的文件会出现在原来的飞书会话里。</p>',
    '</section>',
    '</main>',
    '</body>',
    '</html>'
  ].join('')
}

const formatCodeBlock = (value: unknown) => (
  escapeHtml(JSON.stringify(value ?? null, null, 2))
)

const renderToolCallDetailPage = (input: {
  sessionId: string
  toolUseId: string
  messageId?: string
  sessionUrl?: string
  payload: {
    name: string
    status: string
    args?: unknown
    result?: unknown
  }
}) => {
  const header = `${escapeHtml(normalizeToolDisplayName(input.payload.name))} · ${escapeHtml(input.payload.status)}`
  const sessionLink = input.sessionUrl == null
    ? ''
    : `<p><a href="${escapeHtml(input.sessionUrl)}" target="_blank" rel="noreferrer">尝试打开会话 UI</a></p>`

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${header}</title>`,
    '<style>',
    'body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;}',
    '.wrap{max-width:920px;margin:40px auto;padding:0 20px;}',
    '.card{background:#fff;border:1px solid #dbe2f0;border-radius:18px;padding:24px;box-shadow:0 12px 36px rgba(15,23,42,.08);}',
    'h1{margin:0 0 8px;font-size:26px;line-height:1.25;}',
    'p{margin:8px 0 0;line-height:1.7;}',
    '.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:20px 0;}',
    '.meta-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;}',
    '.meta-item strong{display:block;margin-bottom:4px;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.04em;}',
    'pre{margin:12px 0 0;padding:16px;border-radius:14px;background:#0f172a;color:#e2e8f0;overflow:auto;line-height:1.6;font-size:13px;}',
    'h2{margin:24px 0 0;font-size:18px;}',
    'a{color:#2563eb;text-decoration:none;}',
    'a:hover{text-decoration:underline;}',
    '</style>',
    '</head>',
    '<body>',
    '<main class="wrap">',
    '<section class="card">',
    `<h1>${header}</h1>`,
    '<div class="meta">',
    `<div class="meta-item"><strong>Session</strong>${escapeHtml(input.sessionId)}</div>`,
    `<div class="meta-item"><strong>Tool Use ID</strong>${escapeHtml(input.toolUseId)}</div>`,
    `<div class="meta-item"><strong>Message ID</strong>${escapeHtml(input.messageId ?? '')}</div>`,
    '</div>',
    sessionLink,
    '<h2>传入参数</h2>',
    `<pre>${formatCodeBlock(input.payload.args)}</pre>`,
    '<h2>执行结果</h2>',
    `<pre>${formatCodeBlock(input.payload.result)}</pre>`,
    '</section>',
    '</main>',
    '</body>',
    '</html>'
  ].join('')
}

const parseQueryString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export function channelActionsRouter(): Router {
  const router = new Router()

  router.get('/tool-call-export', async (ctx) => {
    const sessionId = typeof ctx.query.sessionId === 'string' ? ctx.query.sessionId.trim() : ''
    const toolUseId = typeof ctx.query.toolUseId === 'string' ? ctx.query.toolUseId.trim() : ''
    const messageId = typeof ctx.query.messageId === 'string' ? ctx.query.messageId.trim() : undefined

    if (sessionId === '' || toolUseId === '') {
      ctx.status = 400
      ctx.type = 'text/html'
      ctx.body = renderActionPage({
        ok: false,
        title: '缺少必要参数',
        message: '需要同时提供 sessionId 和 toolUseId 才能导出完整工具调用 JSON。'
      })
      return
    }

    const result = await sendChannelToolCallJsonFile(sessionId, toolUseId, messageId)
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
    const sessionId = parseQueryString(ctx.query.sessionId)
    const toolUseId = parseQueryString(ctx.query.toolUseId)
    const messageId = parseQueryString(ctx.query.messageId) || undefined

    if (sessionId === '' || toolUseId === '') {
      ctx.status = 400
      ctx.type = 'text/html'
      ctx.body = renderActionPage({
        ok: false,
        title: '缺少必要参数',
        message: '需要同时提供 sessionId 和 toolUseId 才能查看工具调用详情。'
      })
      return
    }

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
