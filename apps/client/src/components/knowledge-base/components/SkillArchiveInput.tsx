import React from 'react'

const ARCHIVE_ACCEPT = [
  '.zip',
  '.tar',
  '.tgz',
  '.tar.gz',
  '.tar.bz2',
  '.tbz',
  '.tar.xz',
  '.txz',
  '.7z',
  '.gz',
  '.bz2',
  '.xz',
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip2',
  'application/x-xz',
  'application/x-7z-compressed'
].join(',')

interface SkillArchiveInputProps {
  inputRef: React.Ref<HTMLInputElement>
  onSelect: (file: File) => void
}

export function SkillArchiveInput({ inputRef, onSelect }: SkillArchiveInputProps) {
  return (
    <input
      ref={inputRef}
      type='file'
      className='knowledge-base-view__hidden-file-input'
      accept={ARCHIVE_ACCEPT}
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file != null) onSelect(file)
      }}
    />
  )
}
