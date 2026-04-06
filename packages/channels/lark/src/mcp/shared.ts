import { createReadStream } from 'node:fs'
import { lstat, mkdir, realpath } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve as resolvePath } from 'node:path'
import process from 'node:process'

import { Client, Domain } from '@larksuiteoapi/node-sdk'

import type { LarkFileType, LarkMcpRuntimeEnv, LarkMessageReceiveIdType } from './types.js'

export const MAX_IM_FILE_SIZE = 30 * 1024 * 1024
export const MAX_IM_IMAGE_SIZE = 10 * 1024 * 1024

export type LarkClient = Client
export type LarkImClient = Client['im']
export type LarkContactClient = Client['contact']

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

export const ensureSuccess = (label: string, result: unknown) => {
  if (result == null) {
    throw new Error(`${label} failed: empty response`)
  }
  if (!isRecord(result)) {
    return result
  }
  const code = typeof result.code === 'number' ? result.code : undefined
  if (code != null && code !== 0) {
    const msg = typeof result.msg === 'string' && result.msg.trim() !== ''
      ? result.msg.trim()
      : `code ${code}`
    throw new Error(`${label} failed: ${msg}`)
  }
  return result
}

export const createLarkClient = (env: LarkMcpRuntimeEnv): LarkClient => {
  const domain = env.domain === 'Lark' ? Domain.Lark : Domain.Feishu
  return new Client({
    appId: env.appId,
    appSecret: env.appSecret,
    domain
  })
}

export const createImClient = (env: LarkMcpRuntimeEnv): LarkImClient => createLarkClient(env).im

export const resolveDefaultReceiveTarget = (
  env: LarkMcpRuntimeEnv,
  input?: {
    receiveId?: string
    receiveIdType?: LarkMessageReceiveIdType
  }
) => {
  const receiveId = input?.receiveId ?? env.defaultReceiveId ?? env.channelId
  const receiveIdType = input?.receiveIdType ?? env.defaultReceiveIdType ?? 'chat_id'
  if (receiveId == null || receiveId.trim() === '') {
    throw new Error('Missing receive target. Provide receiveId explicitly or start from a bound Lark channel session.')
  }
  return {
    receiveId,
    receiveIdType
  }
}

export const resolveDefaultChatId = (env: LarkMcpRuntimeEnv, chatId?: string) => {
  const resolvedChatId = chatId ?? env.channelId
  if (resolvedChatId == null || resolvedChatId.trim() === '') {
    throw new Error('Missing chatId. Provide chatId explicitly or start from a bound Lark channel session.')
  }
  return resolvedChatId
}

const normalizeRelativePath = (from: string, to: string) => relative(from, to).replaceAll('\\', '/')

const isWithinWorkspaceRoot = (workspaceRoot: string, targetPath: string) => {
  const relativePath = normalizeRelativePath(workspaceRoot, targetPath)
  return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith('../'))
}

const getWorkspaceRoot = async () => await realpath(process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd())

const resolvePathFromWorkspace = (workspaceRoot: string, targetPath: string) => (
  isAbsolute(targetPath) ? targetPath : resolvePath(workspaceRoot, targetPath)
)

export const resolveExistingFilePath = async (filePath: string) => {
  const workspaceRoot = await getWorkspaceRoot()
  const resolvedPath = resolvePathFromWorkspace(workspaceRoot, filePath)
  const realFilePath = await realpath(resolvedPath)
  if (!isWithinWorkspaceRoot(workspaceRoot, realFilePath)) {
    throw new Error(`File path must stay within the workspace root: ${workspaceRoot}`)
  }
  return realFilePath
}

export const createFileReadStream = (filePath: string) => createReadStream(filePath)

export const prepareOutputPath = async (outputPath: string) => {
  const workspaceRoot = await getWorkspaceRoot()
  const resolvedOutputPath = resolvePathFromWorkspace(workspaceRoot, outputPath)
  await mkdir(dirname(resolvedOutputPath), { recursive: true })
  const realParentPath = await realpath(dirname(resolvedOutputPath))
  if (!isWithinWorkspaceRoot(workspaceRoot, realParentPath)) {
    throw new Error(`Output path must stay within the workspace root: ${workspaceRoot}`)
  }

  try {
    const outputPathStat = await lstat(resolvedOutputPath)
    if (outputPathStat.isSymbolicLink()) {
      throw new Error(`Output path cannot be a symbolic link: ${resolvedOutputPath}`)
    }
    const realOutputPath = await realpath(resolvedOutputPath)
    if (!isWithinWorkspaceRoot(workspaceRoot, realOutputPath)) {
      throw new Error(`Output path must stay within the workspace root: ${workspaceRoot}`)
    }
    return realOutputPath
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error
    }
  }

  const finalOutputPath = resolvePath(realParentPath, basename(resolvedOutputPath))
  if (!isWithinWorkspaceRoot(workspaceRoot, finalOutputPath)) {
    throw new Error(`Output path must stay within the workspace root: ${workspaceRoot}`)
  }
  return finalOutputPath
}

export const resolveUploadFileName = (filePath: string, displayName?: string) => (
  displayName?.trim() || basename(filePath)
)

export const resolveMessageContent = (content: unknown) => (
  typeof content === 'string' ? content : JSON.stringify(content)
)

export const resolveLarkFileType = (filePath: string, fileType?: LarkFileType): LarkFileType => {
  if (fileType != null) return fileType

  const extension = extname(filePath).toLowerCase()
  switch (extension) {
    case '.opus':
    case '.ogg':
      return 'opus'
    case '.mp4':
      return 'mp4'
    case '.pdf':
      return 'pdf'
    case '.doc':
    case '.docx':
      return 'doc'
    case '.xls':
    case '.xlsx':
      return 'xls'
    case '.ppt':
    case '.pptx':
      return 'ppt'
    default:
      return 'stream'
  }
}
