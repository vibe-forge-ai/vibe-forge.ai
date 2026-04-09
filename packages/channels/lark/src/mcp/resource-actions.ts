import type { LarkMcpRuntimeEnv, LarkMessageResourceType } from './types.js'
import { ensureSuccess, prepareOutputPath } from './shared.js'
import type { LarkImClient } from './shared.js'

interface LarkDownloadHandle {
  writeFile: (filePath: string) => Promise<unknown>
  headers?: unknown
}

const writeDownloadToPath = async (
  label: string,
  download: unknown,
  outputPath: string
) => {
  const handle = ensureSuccess(label, download) as LarkDownloadHandle
  const resolvedOutputPath = await prepareOutputPath(outputPath)
  await handle.writeFile(resolvedOutputPath)
  return {
    outputPath: resolvedOutputPath,
    headers: handle.headers ?? null
  }
}

export const createLarkResourceActions = (
  _env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  downloadFile: async (input: {
    fileKey: string
    outputPath: string
  }) => await writeDownloadToPath(
    'Download file',
    await im.file.get({
      path: { file_key: input.fileKey }
    }),
    input.outputPath
  ),
  downloadImage: async (input: {
    imageKey: string
    outputPath: string
  }) => await writeDownloadToPath(
    'Download image',
    await im.image.get({
      path: { image_key: input.imageKey }
    }),
    input.outputPath
  ),
  downloadMessageResource: async (input: {
    messageId: string
    fileKey: string
    resourceType: LarkMessageResourceType
    outputPath: string
  }) => await writeDownloadToPath(
    'Download message resource',
    await im.messageResource.get({
      path: {
        message_id: input.messageId,
        file_key: input.fileKey
      },
      params: {
        type: input.resourceType
      }
    }),
    input.outputPath
  )
})
