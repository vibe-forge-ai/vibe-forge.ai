import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

describe('lark channel MCP security boundaries', () => {
  it('rejects sending a local file without explicit share confirmation', async () => {
    vi.resetModules()
    const fileCreate = vi.fn()
    const messageCreate = vi.fn()

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
        channelId: 'chat_1'
      })

      await expect(service.sendFile({
        filePath
      } as never)).rejects.toThrow('Send file requires confirmExternalShare=true.')
      expect(fileCreate).not.toHaveBeenCalled()
      expect(messageCreate).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects reading a local file outside the workspace root before probing it', async () => {
    vi.resetModules()
    const fileCreate = vi.fn()
    const messageCreate = vi.fn()

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

    const tempRoot = await mkdtemp(join(tmpdir(), 'vf-lark-mcp-'))
    const workspacePath = join(tempRoot, 'workspace')
    const outsidePath = join(tempRoot, 'outside')
    await mkdir(workspacePath, { recursive: true })
    await mkdir(outsidePath, { recursive: true })
    const workspaceDir = await realpath(workspacePath)
    const outsideDir = await realpath(outsidePath)
    const filePath = join(outsideDir, 'secret.pdf')
    await writeFile(filePath, 'top secret', 'utf8')

    try {
      vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', workspaceDir)
      const { createLarkMcpService } = await import('#~/mcp/service.js')
      const service = createLarkMcpService({
        appId: 'app_id',
        appSecret: 'app_secret',
        domain: 'Feishu',
        channelId: 'chat_1'
      })

      await expect(service.sendFile({
        filePath,
        confirmExternalShare: true
      })).rejects.toThrow(`File path must stay within the workspace root: ${workspaceDir}`)
      expect(fileCreate).not.toHaveBeenCalled()
      expect(messageCreate).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('rejects writing downloaded resources outside the workspace root without creating directories', async () => {
    vi.resetModules()

    const tempDir = await mkdtemp(join(tmpdir(), 'vf-lark-mcp-'))
    const workspaceDir = await realpath(tempDir)
    const writeFileMock = vi.fn()

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          messageResource: {
            get: vi.fn().mockResolvedValue({
              writeFile: writeFileMock,
              headers: {}
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
      const escapedDirectory = join(dirname(workspaceDir), 'escape-dir')

      await expect(service.downloadMessageResource({
        messageId: 'om_1',
        fileKey: 'file_1',
        resourceType: 'file',
        outputPath: '../escape-dir/escape.txt'
      })).rejects.toThrow(`Output path must stay within the workspace root: ${workspaceDir}`)
      expect(writeFileMock).not.toHaveBeenCalled()
      await expect(lstat(escapedDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      vi.unstubAllEnvs()
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
