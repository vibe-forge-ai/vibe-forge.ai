import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it, vi } from 'vitest'

import type { LarkChannelConfig } from '#~/index.js'

describe('lark channel companion MCP', () => {
  it('resolves a session-scoped MCP server config for bound sessions', async () => {
    vi.resetModules()
    const { resolveChannelSessionMcpServers } = await import('#~/mcp/index.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu'
    }

    const result = await resolveChannelSessionMcpServers(config, {
      sessionId: 'sess-1',
      channelKey: 'default',
      channelType: 'lark',
      channelId: 'chat_1',
      sessionType: 'group',
      replyReceiveId: 'chat_1',
      replyReceiveIdType: 'chat_id'
    })

    expect(result).toBeDefined()
    if (result == null) {
      throw new Error('Expected session MCP resolution result')
    }
    expect(result).toHaveLength(1)
    const server = result[0]
    expect(server).toBeDefined()
    if (server == null) {
      throw new Error('Expected a session-scoped MCP server config')
    }

    expect(server).toMatchObject({
      name: 'channel-lark-default',
      config: {
        command: process.execPath,
        env: expect.objectContaining({
          VF_LARK_APP_ID: 'app_id',
          VF_LARK_APP_SECRET: 'app_secret',
          VF_CHANNEL_ID: 'chat_1',
          VF_LARK_DEFAULT_RECEIVE_ID: 'chat_1',
          VF_LARK_DEFAULT_RECEIVE_ID_TYPE: 'chat_id'
        })
      }
    })
    if (!('args' in server.config)) {
      throw new Error('Expected a stdio MCP server config')
    }
    expect(server.config.args[0]).toContain('/packages/channels/lark/mcp.js')
  })

  it('uploads a local file and sends it to the bound chat', async () => {
    vi.resetModules()
    const fileCreate = vi.fn().mockResolvedValue({ file_key: 'file_1' })
    const messageCreate = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        message_id: 'om_sent'
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          file: {
            create: fileCreate
          },
          message: {
            create: messageCreate
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const tempDir = await mkdtemp(join(tmpdir(), 'vf-lark-mcp-'))
    const workspaceDir = await realpath(tempDir)
    const filePath = join(workspaceDir, 'report.pdf')
    await writeFile(filePath, 'hello world', 'utf8')

    try {
      vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', workspaceDir)
      const { createLarkMcpService } = await import('#~/mcp/service.js')
      const service = createLarkMcpService({
        appId: 'app_id',
        appSecret: 'app_secret',
        domain: 'Feishu',
        channelId: 'chat_1',
        defaultReceiveId: 'chat_1',
        defaultReceiveIdType: 'chat_id'
      })

      const result = await service.sendFile({
        filePath,
        confirmExternalShare: true
      })

      expect(fileCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          file_type: 'pdf',
          file_name: 'report.pdf',
          file: expect.anything()
        })
      })
      expect(messageCreate).toHaveBeenCalledWith({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: 'chat_1',
          msg_type: 'file',
          content: JSON.stringify({ file_key: 'file_1' }),
          uuid: undefined
        }
      })
      expect(result).toMatchObject({
        fileKey: 'file_1',
        messageId: 'om_sent',
        receiveId: 'chat_1',
        receiveIdType: 'chat_id'
      })
    } finally {
      vi.unstubAllEnvs()
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('uploads a local image and sends it to the bound chat', async () => {
    vi.resetModules()
    const imageCreate = vi.fn().mockResolvedValue({ image_key: 'img_1' })
    const messageCreate = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        message_id: 'om_image'
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          image: {
            create: imageCreate
          },
          message: {
            create: messageCreate
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const tempDir = await mkdtemp(join(tmpdir(), 'vf-lark-mcp-'))
    const workspaceDir = await realpath(tempDir)
    const imagePath = join(workspaceDir, 'preview.png')
    await writeFile(imagePath, 'image bytes', 'utf8')

    try {
      vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', workspaceDir)
      const { createLarkMcpService } = await import('#~/mcp/service.js')
      const service = createLarkMcpService({
        appId: 'app_id',
        appSecret: 'app_secret',
        domain: 'Feishu',
        channelId: 'chat_1',
        defaultReceiveId: 'chat_1',
        defaultReceiveIdType: 'chat_id'
      })

      const result = await service.sendImage({
        imagePath,
        confirmExternalShare: true
      })

      expect(imageCreate).toHaveBeenCalledWith({
        data: {
          image_type: 'message',
          image: expect.anything()
        }
      })
      expect(messageCreate).toHaveBeenCalledWith({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: 'chat_1',
          msg_type: 'image',
          content: JSON.stringify({ image_key: 'img_1' }),
          uuid: undefined
        }
      })
      expect(result).toMatchObject({
        imageKey: 'img_1',
        messageId: 'om_image',
        receiveId: 'chat_1',
        receiveIdType: 'chat_id'
      })
    } finally {
      vi.unstubAllEnvs()
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('gets a user profile from the contact directory', async () => {
    vi.resetModules()
    const userGet = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        user: {
          user_id: 'ou_1',
          name: 'Alice'
        }
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {},
        contact: {
          user: {
            get: userGet
          }
        }
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const { createLarkMcpService } = await import('#~/mcp/service.js')
    const service = createLarkMcpService({
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu'
    })

    const result = await service.getUser({
      userId: 'ou_1',
      userIdType: 'open_id'
    })

    expect(userGet).toHaveBeenCalledWith({
      path: {
        user_id: 'ou_1'
      },
      params: {
        user_id_type: 'open_id',
        department_id_type: undefined
      }
    })
    expect(result).toEqual({
      user_id: 'ou_1',
      name: 'Alice'
    })
  })

  it('sends a template card to the bound chat', async () => {
    vi.resetModules()
    const createByCard = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        message_id: 'om_card'
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            createByCard
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const { createLarkMcpService } = await import('#~/mcp/service.js')
    const service = createLarkMcpService({
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu',
      channelId: 'chat_1',
      defaultReceiveId: 'chat_1',
      defaultReceiveIdType: 'chat_id'
    })

    const result = await service.sendTemplateCard({
      templateId: 'ctp_AA',
      templateVariable: {
        title: 'Build done'
      }
    })

    expect(createByCard).toHaveBeenCalledWith({
      params: {
        receive_id_type: 'chat_id'
      },
      data: {
        receive_id: 'chat_1',
        template_id: 'ctp_AA',
        template_variable: {
          title: 'Build done'
        },
        uuid: undefined
      }
    })
    expect(result).toMatchObject({
      templateId: 'ctp_AA',
      receiveId: 'chat_1',
      receiveIdType: 'chat_id',
      messageId: 'om_card'
    })
  })

  it('downloads a message resource into the workspace', async () => {
    vi.resetModules()

    const tempDir = await mkdtemp(join(tmpdir(), 'vf-lark-mcp-'))
    const workspaceDir = await realpath(tempDir)
    const outputPath = join(workspaceDir, 'attachments', 'report.pdf')

    const writeFileMock = vi.fn().mockImplementation(async (targetPath: string) => {
      await writeFile(targetPath, 'downloaded payload', 'utf8')
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          messageResource: {
            get: vi.fn().mockResolvedValue({
              writeFile: writeFileMock,
              headers: {
                'content-type': 'application/pdf'
              }
            })
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    try {
      vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', workspaceDir)
      const { createLarkMcpService } = await import('#~/mcp/service.js')
      const service = createLarkMcpService({
        appId: 'app_id',
        appSecret: 'app_secret',
        domain: 'Feishu'
      })

      const result = await service.downloadMessageResource({
        messageId: 'om_1',
        fileKey: 'file_1',
        resourceType: 'file',
        outputPath
      })

      expect(writeFileMock).toHaveBeenCalledWith(outputPath)
      expect(await readFile(outputPath, 'utf8')).toBe('downloaded payload')
      expect(result).toEqual({
        outputPath,
        headers: {
          'content-type': 'application/pdf'
        }
      })
    } finally {
      vi.unstubAllEnvs()
      await rm(tempDir, { recursive: true, force: true })
    }
  })

})
