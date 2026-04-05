import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AdapterMessageContent } from '@vibe-forge/types'

export const resolveLocalAttachmentPath = (value: string) => {
  if (value.startsWith('file://')) {
    try {
      return fileURLToPath(value)
    } catch {
      return undefined
    }
  }

  return isAbsolute(value) ? value : undefined
}

export const normalizeOpenCodePrompt = (content: AdapterMessageContent[]) => {
  const promptParts: string[] = []
  const files = new Set<string>()

  for (const item of content) {
    if (item.type === 'text') {
      const text = item.text.trim()
      if (text !== '') promptParts.push(text)
      continue
    }

    if (item.type === 'image') {
      const filePath = resolveLocalAttachmentPath(item.url)
      if (filePath) files.add(filePath)
      continue
    }

    if (item.type === 'file') {
      const filePath = item.path.trim()
      if (filePath !== '') files.add(filePath)
      continue
    }

    if (item.type === 'tool_result') {
      promptParts.push(String(item.content))
      continue
    }

    if (item.type === 'tool_use') {
      promptParts.push(`Tool request: ${item.name}`)
    }
  }

  return {
    prompt: promptParts.join('\n\n').trim() || (
      files.size > 0 ? 'Please inspect the attached file(s).' : 'Continue.'
    ),
    files: Array.from(files)
  }
}

export const buildOpenCodeSessionTitle = (
  sessionId: string,
  titlePrefix: string = 'Vibe Forge'
) => `${titlePrefix}:${sessionId}`
