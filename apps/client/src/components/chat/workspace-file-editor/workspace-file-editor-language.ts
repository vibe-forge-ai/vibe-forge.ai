const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  css: 'css',
  go: 'go',
  html: 'html',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  less: 'less',
  md: 'markdown',
  mjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'shell',
  ts: 'typescript',
  tsx: 'typescript',
  yaml: 'yaml',
  yml: 'yaml'
}

const LANGUAGE_BY_FILE_NAME: Record<string, string> = {
  Dockerfile: 'dockerfile'
}

export const getWorkspaceFileEditorLanguage = (path: string) => {
  const fileName = path.split('/').pop() ?? path
  const exactLanguage = LANGUAGE_BY_FILE_NAME[fileName]
  if (exactLanguage != null) {
    return exactLanguage
  }

  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : ''
  return LANGUAGE_BY_EXTENSION[extension] ?? 'plaintext'
}
