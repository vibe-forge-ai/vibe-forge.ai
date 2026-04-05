export interface PendingImage {
  id: string
  url: string
  name?: string
  size?: number
  mimeType?: string
}

export interface PendingContextFile {
  path: string
  name?: string
  size?: number
}

export interface SenderComposerState {
  input: string
  pendingImages: PendingImage[]
  pendingFiles: PendingContextFile[]
}
