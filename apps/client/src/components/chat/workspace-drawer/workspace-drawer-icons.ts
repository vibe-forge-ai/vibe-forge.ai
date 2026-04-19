export interface WorkspaceDrawerIconMeta {
  badgeIcon?: string
  icon: string
  tone: string
}

const normalizeName = (name: string) => name.trim().toLowerCase()

const getExtension = (name: string) => {
  const normalized = normalizeName(name)
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex <= 0 ? '' : normalized.slice(dotIndex + 1)
}

export const getWorkspaceFolderIconMeta = (name: string, expanded: boolean): WorkspaceDrawerIconMeta => {
  const normalized = normalizeName(name)
  const icon = expanded ? 'folder_open' : 'folder'
  if (normalized === '.github') return { icon, tone: 'github', badgeIcon: 'commit' }
  if (normalized === '.ai' || normalized === '.codex') return { icon, tone: 'ai', badgeIcon: 'auto_awesome' }
  if (normalized === 'apps') return { icon, tone: 'app', badgeIcon: 'apps' }
  if (normalized === 'packages') return { icon, tone: 'package', badgeIcon: 'inventory_2' }
  if (normalized === 'scripts' || normalized === 'bin') return { icon, tone: 'script', badgeIcon: 'terminal' }
  if (normalized === 'docs' || normalized === '.docs' || normalized === 'changelog') {
    return { icon, tone: 'docs', badgeIcon: 'article' }
  }
  if (normalized === 'src') return { icon, tone: 'source', badgeIcon: 'code' }
  if (normalized.includes('component')) return { icon, tone: 'component', badgeIcon: 'widgets' }
  if (normalized.includes('route')) return { icon, tone: 'route', badgeIcon: 'alt_route' }
  if (normalized.includes('hook')) return { icon, tone: 'hook', badgeIcon: 'link' }
  if (normalized.includes('api') || normalized.includes('service')) return { icon, tone: 'api', badgeIcon: 'api' }
  if (normalized.includes('style') || normalized.includes('scss') || normalized.includes('css')) {
    return { icon, tone: 'style', badgeIcon: 'palette' }
  }
  if (normalized.includes('asset') || normalized === 'public') return { icon, tone: 'asset', badgeIcon: 'image' }
  if (normalized.includes('test') || normalized === '__tests__') return { icon, tone: 'test', badgeIcon: 'checklist' }
  return { icon, tone: 'folder' }
}

export const getWorkspaceFileIconMeta = (name: string): WorkspaceDrawerIconMeta => {
  const normalized = normalizeName(name)
  const extension = getExtension(name)
  if (normalized === 'package.json') return { icon: 'inventory_2', tone: 'package' }
  if (normalized.includes('lock')) return { icon: 'lock', tone: 'lock' }
  if (normalized.startsWith('.env')) return { icon: 'key', tone: 'env' }
  if (normalized.includes('config')) return { icon: 'tune', tone: 'config' }
  if (normalized.includes('readme') || extension === 'md' || extension === 'mdx') {
    return { icon: 'article', tone: 'docs' }
  }
  if (normalized.includes('gitignore') || normalized.includes('dockerignore')) {
    return { icon: 'hide_source', tone: 'ignore' }
  }
  if (extension === 'ts' || extension === 'tsx') return { icon: 'data_object', tone: 'typescript' }
  if (extension === 'js' || extension === 'jsx' || extension === 'mjs' || extension === 'cjs') {
    return { icon: 'javascript', tone: 'javascript' }
  }
  if (extension === 'json') return { icon: 'data_object', tone: 'json' }
  if (extension === 'scss' || extension === 'sass' || extension === 'css') return { icon: 'palette', tone: 'style' }
  if (extension === 'html') return { icon: 'language', tone: 'html' }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(extension)) {
    return { icon: 'image', tone: 'image' }
  }
  if (['yml', 'yaml', 'toml'].includes(extension)) return { icon: 'settings', tone: 'config' }
  if (['sh', 'bash', 'zsh'].includes(extension)) return { icon: 'terminal', tone: 'script' }
  return { icon: 'draft', tone: 'file' }
}

export const getWorkspaceLinkedIconMeta = (
  name: string,
  linkType: 'directory' | 'file' | 'missing' | 'other' | undefined,
  expanded: boolean,
  linkKind: 'gitdir' | 'symlink' = 'symlink'
): WorkspaceDrawerIconMeta => {
  if (linkKind === 'gitdir') {
    return {
      icon: expanded ? 'folder_open' : 'folder',
      tone: linkType === 'missing' ? 'symlink-broken' : 'git'
    }
  }

  if (linkType === 'missing') {
    return { icon: 'draft', tone: 'symlink-broken', badgeIcon: 'link_off' }
  }

  if (linkType === 'directory') {
    return getWorkspaceFolderIconMeta(name, expanded)
  }

  if (linkType === 'file') {
    return getWorkspaceFileIconMeta(name)
  }

  return { icon: 'draft', tone: 'symlink' }
}

export const getWorkspaceLinkIndicatorIconMeta = (
  linkKind: 'gitdir' | 'symlink',
  linkType: 'directory' | 'file' | 'missing' | 'other' | undefined,
  isExternal?: boolean
): WorkspaceDrawerIconMeta => {
  if (linkType === 'missing') {
    return { icon: 'link_off', tone: 'symlink-broken' }
  }
  if (linkKind === 'gitdir') {
    return { icon: 'account_tree', tone: 'git' }
  }
  if (isExternal === true) {
    return { icon: 'open_in_new', tone: 'symlink-external' }
  }
  return { icon: 'link', tone: 'symlink' }
}
