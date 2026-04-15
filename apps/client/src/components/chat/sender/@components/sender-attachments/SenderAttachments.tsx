import './SenderAttachments.scss'

import { useTranslation } from 'react-i18next'

import type { PendingContextFile, PendingImage } from '../../@types/sender-composer'

const formatAttachmentSize = (size?: number) => {
  if (size == null || Number.isNaN(size) || size <= 0) {
    return null
  }

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

const getFileDisplayName = (file: PendingContextFile) => {
  if (file.name != null && file.name !== '') {
    return file.name
  }

  const parts = file.path.split(/[\\/]/)
  return parts.at(-1) ?? file.path
}

const getFileParentPath = (path: string) => {
  const normalized = path.replace(/\\/g, '/')
  const lastSlashIndex = normalized.lastIndexOf('/')
  if (lastSlashIndex <= 0) {
    return '.'
  }

  return normalized.slice(0, lastSlashIndex)
}

export function SenderAttachments({
  pendingImages,
  pendingFiles,
  onRemovePendingImage,
  onRemovePendingFile
}: {
  pendingImages: PendingImage[]
  pendingFiles: PendingContextFile[]
  onRemovePendingImage: (id: string) => void
  onRemovePendingFile: (path: string) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      {(pendingImages.length > 0 || pendingFiles.length > 0) && (
        <div className='pending-attachments'>
          {pendingFiles.length > 0 && (
            <div className='pending-attachments__files'>
              {pendingFiles.map((file) => {
                const sizeLabel = formatAttachmentSize(file.size)

                return (
                  <div key={file.path} className='pending-context-file'>
                    <div className='pending-context-file__meta'>
                      <span className='material-symbols-rounded pending-context-file__icon'>attach_file</span>
                      <div className='pending-context-file__copy'>
                        <span className='pending-context-file__name'>{getFileDisplayName(file)}</span>
                        <code className='pending-context-file__path'>{getFileParentPath(file.path)}</code>
                      </div>
                    </div>
                    <div className='pending-context-file__actions'>
                      {sizeLabel != null && <span className='pending-context-file__size'>{sizeLabel}</span>}
                      <button
                        type='button'
                        className='pending-context-file__remove'
                        onClick={() => onRemovePendingFile(file.path)}
                      >
                        <span className='material-symbols-rounded'>close</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {pendingImages.length > 0 && (
            <div className='pending-attachments__images'>
              {pendingImages.map((image) => {
                const displayName = image.name ?? t('chat.attachments.pastedImage')
                const sizeLabel = formatAttachmentSize(image.size)

                return (
                  <div key={image.id} className='pending-image'>
                    <img src={image.url} alt={image.name ?? ''} />
                    <div className='pending-image__overlay'>
                      <div className='pending-image__meta'>
                        <span className='pending-image__name'>{displayName}</span>
                        {sizeLabel != null && <span className='pending-image__size'>{sizeLabel}</span>}
                      </div>
                    </div>
                    <button
                      type='button'
                      className='pending-image-remove'
                      onClick={() => onRemovePendingImage(image.id)}
                    >
                      <span className='material-symbols-rounded'>close</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
