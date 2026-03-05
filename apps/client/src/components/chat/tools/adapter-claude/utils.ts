export function getFileInfo(filePath?: string) {
  const resolvedPath = (filePath != null && filePath !== '') ? filePath : 'unknown file'
  const lastSlashIndex = resolvedPath.lastIndexOf('/')
  const fileName = lastSlashIndex >= 0 ? resolvedPath.slice(lastSlashIndex + 1) : resolvedPath
  const dirPath = lastSlashIndex >= 0 ? resolvedPath.slice(0, lastSlashIndex) : ''

  return { filePath: resolvedPath, fileName, dirPath }
}

export function getLanguageFromPath(path: string) {
  const extPart = path.split('.').pop()
  const ext = (extPart != null && extPart !== '') ? extPart.toLowerCase() : ''
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'md': 'markdown',
    'json': 'json',
    'scss': 'scss',
    'css': 'css',
    'html': 'html',
    'sh': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
    'sql': 'sql'
  }
  return langMap[ext] || 'text'
}

export function normalizeResultLines(content: unknown): string[] {
  if (Array.isArray(content)) {
    return content.map(String)
  }

  if (typeof content !== 'string') {
    return []
  }

  const trimmed = content.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map(String)
      }
    } catch {
      return content.split('\n')
    }
  }

  return content.split('\n')
}
