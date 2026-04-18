import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import { readSessionWorkspaceFile, readWorkspaceFile, updateSessionWorkspaceFile, updateWorkspaceFile } from '#~/api'

const AUTOSAVE_DELAY_MS = 600

export function useWorkspaceFileEditorState({
  onSaveError,
  path,
  sessionId
}: {
  onSaveError: (err: unknown) => void
  path: string
  sessionId?: string
}) {
  const loadedPathRef = useRef<string | null>(null)
  const failedContentRef = useRef<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const hasSession = sessionId != null && sessionId !== ''
  const swrKey = hasSession
    ? ['workspace-file-editor', sessionId, path]
    : ['workspace-file-editor', 'workspace', path]
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () =>
      sessionId != null && sessionId !== ''
        ? readSessionWorkspaceFile(sessionId, path)
        : readWorkspaceFile(path),
    { revalidateOnFocus: false }
  )
  const isDirty = draft !== savedContent

  useEffect(() => {
    if (data == null) {
      loadedPathRef.current = null
      setDraft('')
      setSavedContent('')
      return
    }

    if (loadedPathRef.current === data.path) {
      return
    }

    loadedPathRef.current = data.path
    failedContentRef.current = null
    setDraft(data.content)
    setSavedContent(data.content)
  }, [data])

  const saveContent = useCallback(async (content: string) => {
    setIsSaving(true)
    try {
      const result = sessionId != null && sessionId !== ''
        ? await updateSessionWorkspaceFile(sessionId, path, content)
        : await updateWorkspaceFile(path, content)
      failedContentRef.current = null
      setSavedContent(result.content)
      await mutate(result, false)
    } catch (err) {
      failedContentRef.current = content
      onSaveError(err)
    } finally {
      setIsSaving(false)
    }
  }, [mutate, onSaveError, path, sessionId])

  useEffect(() => {
    if (
      !isDirty ||
      isSaving ||
      isLoading ||
      error != null ||
      data == null ||
      failedContentRef.current === draft
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveContent(draft)
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [data, draft, error, isDirty, isLoading, isSaving, saveContent])

  const saveNow = useCallback(() => {
    if (!isDirty || isSaving) {
      return
    }
    void saveContent(draft)
  }, [draft, isDirty, isSaving, saveContent])

  return {
    data,
    draft,
    error,
    isLoading,
    isSaving,
    saveNow,
    setDraft
  }
}
