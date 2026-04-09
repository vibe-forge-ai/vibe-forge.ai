import { z } from 'zod'

import { larkMessageResourceTypeSchema } from './types.js'
import type { RegisterServer } from './register-utils.js'
import { toJsonResult } from './register-utils.js'

const downloadFileSchema = z.object({
  fileKey: z.string().min(1).describe('Lark file_key to download'),
  outputPath: z.string().min(1).describe('Workspace-relative or workspace-contained absolute local path to write')
})

const downloadImageSchema = z.object({
  imageKey: z.string().min(1).describe('Lark image_key to download'),
  outputPath: z.string().min(1).describe('Workspace-relative or workspace-contained absolute local path to write')
})

const downloadMessageResourceSchema = z.object({
  messageId: z.string().min(1).describe('Lark message_id that contains the resource'),
  fileKey: z.string().min(1).describe('Lark file_key or image_key referenced by the message'),
  resourceType: larkMessageResourceTypeSchema.describe('Resource type inside the message'),
  outputPath: z.string().min(1).describe('Workspace-relative or workspace-contained absolute local path to write')
})

export const registerLarkResourceTools = (
  server: RegisterServer,
  service: {
    downloadFile: (input: z.infer<typeof downloadFileSchema>) => Promise<unknown>
    downloadImage: (input: z.infer<typeof downloadImageSchema>) => Promise<unknown>
    downloadMessageResource: (input: z.infer<typeof downloadMessageResourceSchema>) => Promise<unknown>
  }
) => {
  server.registerTool(
    'DownloadFile',
    {
      title: 'Download File',
      description: 'Download a file previously uploaded by this app into the workspace.',
      inputSchema: downloadFileSchema
    },
    async (input: z.infer<typeof downloadFileSchema>) => toJsonResult(await service.downloadFile(input))
  )

  server.registerTool(
    'DownloadImage',
    {
      title: 'Download Image',
      description: 'Download an image previously uploaded by this app into the workspace.',
      inputSchema: downloadImageSchema
    },
    async (input: z.infer<typeof downloadImageSchema>) => toJsonResult(await service.downloadImage(input))
  )

  server.registerTool(
    'DownloadMessageResource',
    {
      title: 'Download Message Resource',
      description: 'Download a file, image, audio, or video resource from a visible Lark message into the workspace.',
      inputSchema: downloadMessageResourceSchema
    },
    async (input: z.infer<typeof downloadMessageResourceSchema>) => toJsonResult(await service.downloadMessageResource(input))
  )
}
