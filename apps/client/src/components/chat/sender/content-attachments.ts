import type { ChatMessageContent } from '@vibe-forge/core'

export interface PendingImage {
  id: string
  url: string
  name?: string
  size?: number
  mimeType?: string
}

export interface PendingContextFile {
  path: string
  name?: string
  size?: number
}

export interface SenderComposerState {
  input: string
  pendingImages: PendingImage[]
  pendingFiles: PendingContextFile[]
}

export const createPendingImageId = (index: number) => `pending-image-${index}`

export const getInitialComposerState = (content: string | ChatMessageContent[] | undefined): SenderComposerState => {
  if (typeof content === 'string') {
    return {
      input: content,
      pendingImages: [],
      pendingFiles: []
    }
  }

  if (!Array.isArray(content)) {
    return {
      input: '',
      pendingImages: [],
      pendingFiles: []
    }
  }

  const textItems = content
    .filter((item): item is Extract<ChatMessageContent, { type: 'text' }> => item.type === 'text')
    .map(item => item.text)
  const imageItems = content
    .filter((item): item is Extract<ChatMessageContent, { type: 'image' }> => item.type === 'image')
    .map((item, index) => ({
      id: createPendingImageId(index),
      url: item.url,
      name: item.name,
      size: item.size,
      mimeType: item.mimeType
    }))
  const fileItems = content
    .filter((item): item is Extract<ChatMessageContent, { type: 'file' }> => item.type === 'file')
    .map(item => ({
      path: item.path,
      name: item.name,
      size: item.size
    }))

  return {
    input: textItems.join('\n\n'),
    pendingImages: imageItems,
    pendingFiles: fileItems
  }
}

export const buildMessageContent = (
  input: string,
  pendingImages: PendingImage[],
  pendingFiles: PendingContextFile[]
) => {
  const content: ChatMessageContent[] = []
  if (input.trim() !== '') {
    content.push({ type: 'text', text: input.trim() })
  }

  content.push(...pendingImages.map((img): ChatMessageContent => ({
    type: 'image',
    url: img.url,
    name: img.name,
    size: img.size,
    mimeType: img.mimeType
  })))
  content.push(...pendingFiles.map((file): ChatMessageContent => ({
    type: 'file',
    path: file.path,
    name: file.name,
    size: file.size
  })))

  return content
}
