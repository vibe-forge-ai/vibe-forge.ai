import type { ChannelActionTokenErrorCode } from '#~/channels/action-token.js'
import { normalizeToolDisplayName } from '#~/channels/tool-call-name.js'

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')

export const renderActionPage = (input: {
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

export const renderExportLaunchPage = (token: string) => {
  const escapedToken = escapeHtml(token)
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>准备发送完整 JSON 文件</title>',
    '<style>',
    'body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7fb;color:#0f172a;}',
    '.wrap{max-width:720px;margin:48px auto;padding:0 20px;}',
    '.card{background:#fff;border:1px solid #dbe2f0;border-radius:16px;padding:24px;box-shadow:0 12px 40px rgba(15,23,42,.08);}',
    'h1{margin:0 0 12px;font-size:24px;line-height:1.3;color:#0f172a;}',
    'p{margin:12px 0;line-height:1.7;}',
    'button{margin-top:16px;border:0;border-radius:10px;padding:10px 16px;background:#2563eb;color:#fff;font-size:14px;cursor:pointer;}',
    'button:hover{background:#1d4ed8;}',
    '</style>',
    '</head>',
    '<body>',
    '<main class="wrap">',
    '<section class="card">',
    '<h1>准备发送完整 JSON 文件</h1>',
    '<p>点击下面的按钮后，机器人会把这次工具调用的完整 JSON 文件回传到原来的飞书会话。</p>',
    '<form id="export-form" method="post">',
    `<input type="hidden" name="token" value="${escapedToken}">`,
    '<button type="submit">发送完整 JSON 文件</button>',
    '</form>',
    '</section>',
    '</main>',
    '</body>',
    '</html>'
  ].join('')
}

const formatCodeBlock = (value: unknown) => escapeHtml(JSON.stringify(value ?? null, null, 2))

export const renderToolCallDetailPage = (input: {
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

export const resolveActionTokenErrorPage = (code: ChannelActionTokenErrorCode) => {
  if (code === 'expired') {
    return {
      status: 410,
      title: '操作链接已过期',
      message: '这个链接已经失效，请回到原始会话重新打开最新的工具调用卡片。'
    }
  }

  if (code === 'replayed') {
    return {
      status: 409,
      title: '操作已经执行过',
      message: '这个导出链接已经被使用过一次，不会重复发送文件。请回到原始会话重新触发。'
    }
  }

  if (code === 'unavailable') {
    return {
      status: 503,
      title: '操作暂时不可用',
      message: '当前服务没有配置工具动作签名密钥，暂时无法处理这个链接。请联系部署者配置后重试。'
    }
  }

  return {
    status: code === 'missing' || code === 'malformed' ? 400 : 403,
    title: '无效的操作链接',
    message: '这个工具调用链接无效，或已经不再允许访问。请回到原始会话重新打开。'
  }
}
