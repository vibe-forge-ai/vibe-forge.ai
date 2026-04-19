export interface ProjectFileTreeIconMeta {
  badgeIcon?: string
  icon: string
  tone: string
}

export const getProjectFolderIconMeta = (name: string, expanded: boolean): ProjectFileTreeIconMeta => {
  const normalized = name.toLowerCase()
  const icon = expanded ? 'folder_open' : 'folder'
  if (normalized === '.ai') return { icon, tone: 'ai', badgeIcon: 'auto_awesome' }
  if (normalized === '.docs' || normalized === 'docs' || normalized === 'doc') {
    return { icon, tone: 'docs', badgeIcon: 'article' }
  }
  if (normalized === '.github' || normalized === '.gitlab' || normalized === '.git') {
    return { icon, tone: 'git', badgeIcon: 'commit' }
  }
  if (normalized.includes('test') || normalized === '__tests__' || normalized === '__test__') {
    return { icon, tone: 'test', badgeIcon: 'science' }
  }
  if (normalized === 'src' || normalized === 'source') return { icon, tone: 'source', badgeIcon: 'code' }
  if (normalized === 'apps' || normalized === 'packages') return { icon, tone: 'package', badgeIcon: 'inventory_2' }
  if (normalized === 'scripts' || normalized === 'bin') return { icon, tone: 'script', badgeIcon: 'terminal' }
  if (normalized === 'public' || normalized === 'assets' || normalized === 'static') {
    return { icon, tone: 'asset', badgeIcon: 'image' }
  }
  if (normalized === 'components') return { icon, tone: 'component', badgeIcon: 'widgets' }
  if (normalized === 'routes' || normalized === 'pages') return { icon, tone: 'route', badgeIcon: 'alt_route' }
  if (normalized === 'api' || normalized === 'server') return { icon, tone: 'api', badgeIcon: 'hub' }
  if (normalized.includes('hook')) return { icon, tone: 'hook', badgeIcon: 'link' }
  return { icon, tone: 'folder' }
}

export const getProjectFileIconMeta = (name: string): ProjectFileTreeIconMeta => {
  const normalized = name.toLowerCase()
  if (/\.(?:ts|tsx|mts|cts)$/.test(normalized)) return { icon: 'data_object', tone: 'typescript' }
  if (/\.(?:js|jsx|mjs|cjs)$/.test(normalized)) return { icon: 'javascript', tone: 'javascript' }
  if (/\.(?:json|jsonc)$/.test(normalized)) return { icon: 'tune', tone: 'json' }
  if (/\.(?:md|mdx)$/.test(normalized)) return { icon: 'article', tone: 'markdown' }
  if (/\.(?:css|scss|sass|less|pcss)$/.test(normalized)) return { icon: 'palette', tone: 'style' }
  if (/\.(?:png|jpe?g|gif|svg|webp|avif|ico)$/.test(normalized)) return { icon: 'image', tone: 'image' }
  if (/\.(?:lock|lockb)$/.test(normalized)) return { icon: 'lock', tone: 'lock' }
  if (normalized.includes('package.json') || normalized.endsWith('.yaml') || normalized.endsWith('.yml')) {
    return { icon: 'inventory_2', tone: 'package' }
  }
  if (normalized.startsWith('.env')) return { icon: 'key', tone: 'env' }
  if (normalized.includes('ignore')) return { icon: 'hide_source', tone: 'ignore' }
  return { icon: 'draft', tone: 'file' }
}

export const getProjectLinkedIconMeta = (
  name: string,
  linkType: 'directory' | 'file' | 'missing' | 'other' | undefined,
  expanded: boolean,
  linkKind: 'gitdir' | 'symlink' = 'symlink'
): ProjectFileTreeIconMeta => {
  if (linkKind === 'gitdir') {
    return {
      ...getProjectFolderIconMeta(name, expanded),
      tone: linkType === 'missing' ? 'symlink-broken' : 'git'
    }
  }

  if (linkType === 'missing') {
    return { icon: 'draft', tone: 'symlink-broken', badgeIcon: 'link_off' }
  }

  if (linkType === 'directory') {
    return { ...getProjectFolderIconMeta(name, expanded), badgeIcon: 'link' }
  }

  if (linkType === 'file') {
    return { ...getProjectFileIconMeta(name), badgeIcon: 'link' }
  }

  return { icon: 'draft', tone: 'symlink' }
}

export const getProjectLinkIndicatorIconMeta = (
  linkKind: 'gitdir' | 'symlink',
  linkType: 'directory' | 'file' | 'missing' | 'other' | undefined,
  isExternal?: boolean
): ProjectFileTreeIconMeta => {
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
