export function WorkspaceFileBreadcrumb({ path }: { path: string }) {
  const parts = path.split('/').filter(Boolean)

  return (
    <div className='workspace-file-editor__breadcrumb' title={path} data-dock-panel-no-resize='true'>
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1
        return (
          <span key={`${part}:${index}`} className='workspace-file-editor__breadcrumb-part'>
            <span className={isLast ? 'is-current' : undefined}>{part}</span>
            {!isLast && <span className='workspace-file-editor__breadcrumb-separator'>/</span>}
          </span>
        )
      })}
    </div>
  )
}
