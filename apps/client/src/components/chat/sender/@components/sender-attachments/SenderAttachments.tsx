import './SenderAttachments.scss'

import type { PendingContextFile, PendingImage } from '../../@types/sender-composer'

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
  return (
    <>
      {pendingImages.length > 0 && (
        <div className='pending-images'>
          {pendingImages.map(image => (
            <div key={image.id} className='pending-image'>
              <img src={image.url} alt={image.name ?? 'image'} />
              <div className='pending-image-remove' onClick={() => onRemovePendingImage(image.id)}>
                <span className='material-symbols-rounded'>close</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {pendingFiles.length > 0 && (
        <div className='pending-context-files'>
          {pendingFiles.map(file => (
            <div key={file.path} className='pending-context-file'>
              <div className='pending-context-file__meta'>
                <span className='material-symbols-rounded pending-context-file__icon'>description</span>
                <code className='pending-context-file__path'>{file.path}</code>
              </div>
              <div className='pending-context-file__remove' onClick={() => onRemovePendingFile(file.path)}>
                <span className='material-symbols-rounded'>close</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
