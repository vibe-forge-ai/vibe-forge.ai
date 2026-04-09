import http from 'node:http'

import Koa from 'koa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendChannelToolCallJsonFile = vi.fn()
const resolveToolCallPayload = vi.fn()

vi.mock('#~/channels/index.js', () => ({
  sendChannelToolCallJsonFile
}))

vi.mock('#~/channels/tool-call-file.js', () => ({
  resolveToolCallPayload
}))

describe('channel action routes', () => {
  let server: http.Server | undefined
  let baseUrl = ''

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    sendChannelToolCallJsonFile.mockReset()
    resolveToolCallPayload.mockReset()

    const app = new Koa()
    const { initMiddlewares } = await import('#~/middlewares/index.js')
    const { mountRoutes } = await import('#~/routes/index.js')
    await initMiddlewares(app)
    await mountRoutes(
      app,
      {
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: 0,
        __VF_PROJECT_AI_SERVER_WS_PATH__: '/ws'
      } as Parameters<typeof mountRoutes>[1]
    )

    server = http.createServer(app.callback())
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    if (address == null || typeof address === 'string') {
      throw new Error('Failed to start test server')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve()
        return
      }
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
    server = undefined
    baseUrl = ''
    vi.unstubAllEnvs()
  })

  it('does not execute export side effects on GET and only allows POST once', async () => {
    const { createChannelActionToken } = await import('#~/channels/action-token.js')
    sendChannelToolCallJsonFile.mockResolvedValue({
      ok: true,
      statusCode: 200,
      message: 'ok',
      fileName: 'tool.json'
    })
    const token = createChannelActionToken({
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1',
      oneTime: true
    })

    const getResponse = await fetch(`${baseUrl}/channels/actions/tool-call-export?token=${encodeURIComponent(token)}`)
    const getHtml = await getResponse.text()
    expect(getResponse.status).toBe(200)
    expect(getHtml).toContain('准备发送完整 JSON 文件')
    expect(getHtml).toContain('点击下面的按钮后')
    expect(getHtml).toContain('<button type="submit">发送完整 JSON 文件</button>')
    expect(getHtml).toContain('<form id="export-form" method="post">')
    expect(getHtml).not.toContain('action="/channels/actions/tool-call-export"')
    expect(getHtml).not.toContain('requestSubmit()')
    expect(sendChannelToolCallJsonFile).not.toHaveBeenCalled()

    const postResponse = await fetch(`${baseUrl}/channels/actions/tool-call-export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ token }).toString()
    })
    const postHtml = await postResponse.text()
    expect(postResponse.status).toBe(200)
    expect(postHtml).toContain('已请求发送完整 JSON 文件')
    expect(sendChannelToolCallJsonFile).toHaveBeenCalledTimes(1)
    expect(sendChannelToolCallJsonFile).toHaveBeenCalledWith('sess-1', 'tool-1', 'msg-1')

    const replayResponse = await fetch(`${baseUrl}/channels/actions/tool-call-export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ token }).toString()
    })
    const replayHtml = await replayResponse.text()
    expect(replayResponse.status).toBe(409)
    expect(replayHtml).toContain('操作已经执行过')
    expect(sendChannelToolCallJsonFile).toHaveBeenCalledTimes(1)
  })

  it('requires a valid signed token to open detail pages', async () => {
    const { createChannelActionToken } = await import('#~/channels/action-token.js')
    resolveToolCallPayload.mockReturnValue({
      name: 'adapter:claude-code:mcp__channel-lark-test__GetCurrentChatMessages',
      status: 'success',
      args: { limit: 5 },
      result: { matchedCount: 5 }
    })
    const token = createChannelActionToken({
      action: 'tool-call-detail',
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })

    const okResponse = await fetch(`${baseUrl}/channels/actions/tool-call-detail?token=${encodeURIComponent(token)}`)
    const okHtml = await okResponse.text()
    expect(okResponse.status).toBe(200)
    expect(okHtml).toContain('GetCurrentChatMessages · success')
    expect(resolveToolCallPayload).toHaveBeenCalledWith('sess-1', 'tool-1')

    const badResponse = await fetch(`${baseUrl}/channels/actions/tool-call-detail?token=bad-token`)
    const badHtml = await badResponse.text()
    expect(badResponse.status).toBe(400)
    expect(badHtml).toContain('无效的操作链接')
  })
})
