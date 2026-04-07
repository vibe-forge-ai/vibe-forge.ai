export interface CodeBlockContent {
  language: 'json' | 'text'
  content: string
}

export interface TruncatedCodeBlockContent extends CodeBlockContent {
  truncated: boolean
}

const MAX_RESULT_PREVIEW_LINES = 12

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

export const resolveCodeBlockContent = (value: string): CodeBlockContent => {
  const parsed = tryParseJson(value)
  if (parsed != null) {
    return {
      language: 'json',
      content: JSON.stringify(parsed, null, 2)
    }
  }

  return {
    language: 'text',
    content: value
  }
}

export const formatCodeBlock = (content: CodeBlockContent) => (
  `\`\`\`${content.language}\n${content.content}\n\`\`\``
)

export const buildSummarySectionText = (title: string, value: CodeBlockContent) => (
  `**${title}**\n${formatCodeBlock(value)}`
)

export const truncateCodeBlockContent = (
  value: string,
  maxLines = MAX_RESULT_PREVIEW_LINES
): TruncatedCodeBlockContent => {
  const content = resolveCodeBlockContent(value)
  const lines = content.content.split('\n')
  if (lines.length <= maxLines) {
    return {
      ...content,
      truncated: false
    }
  }

  return {
    language: content.language,
    content: [...lines.slice(0, Math.max(0, maxLines - 1)), '...'].join('\n'),
    truncated: true
  }
}
