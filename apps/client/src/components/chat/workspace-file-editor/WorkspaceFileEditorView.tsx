import './WorkspaceFileEditorView.scss'

import Editor from '@monaco-editor/react'
import { App, Empty, Spin } from 'antd'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getApiErrorMessage, getSessionWorkspaceResourceUrl, getWorkspaceResourceUrl } from '#~/api'
import {
  CHAT_BOTTOM_DOCK_DEFAULT_HEIGHT,
  CHAT_BOTTOM_DOCK_HEIGHT_STORAGE_KEY,
  CHAT_BOTTOM_DOCK_MAX_HEIGHT,
  CHAT_BOTTOM_DOCK_MIN_HEIGHT
} from '#~/components/chat/bottom-dock-constants'
import { DockPanel } from '#~/components/dock-panel/DockPanel'
import { monacoApi } from '#~/components/monaco/monaco-runtime'
import { useMonacoTheme } from '#~/components/monaco/use-monaco-theme'

import { WorkspaceFileBreadcrumb } from './WorkspaceFileBreadcrumb'
import { WorkspaceFileTabs } from './WorkspaceFileTabs'
import { useWorkspaceFileEditorState } from './use-workspace-file-editor-state'
import { getWorkspaceFileEditorLanguage, isWorkspaceImagePreviewPath } from './workspace-file-editor-language'

export function WorkspaceFileEditorView({
  isOpen,
  onClose,
  onClosePath,
  onSelectPath,
  openPaths,
  path,
  sessionId
}: {
  isOpen: boolean
  onClose: () => void
  onClosePath: (path: string) => void
  onSelectPath: (path: string) => void
  openPaths: string[]
  path: string
  sessionId?: string
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const themeName = useMonacoTheme()
  const editorRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(null)
  const saveHandlerRef = useRef<() => void>(() => undefined)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const language = useMemo(() => getWorkspaceFileEditorLanguage(path), [path])
  const isImagePreview = useMemo(() => isWorkspaceImagePreviewPath(path), [path])
  const imageUrl = useMemo(() => {
    return sessionId != null && sessionId !== ''
      ? getSessionWorkspaceResourceUrl(sessionId, path)
      : getWorkspaceResourceUrl(path)
  }, [path, sessionId])
  const handleSaveError = useCallback((err: unknown) => {
    void message.error(getApiErrorMessage(err, t('common.operationFailed')))
  }, [message, t])
  const { data, draft, error, isLoading, saveNow, setDraft } = useWorkspaceFileEditorState({
    enabled: !isImagePreview,
    path,
    sessionId,
    onSaveError: handleSaveError
  })

  useEffect(() => {
    setImageLoadFailed(false)
  }, [imageUrl])

  useEffect(() => {
    saveHandlerRef.current = () => {
      saveNow()
    }
  }, [saveNow])

  const handleMount = (
    editor: MonacoEditorNamespace.IStandaloneCodeEditor
  ) => {
    editorRef.current = editor
    editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyS, () => {
      saveHandlerRef.current()
    })
    editor.focus()
  }

  return (
    <DockPanel
      className='workspace-file-editor'
      allowFullscreen
      defaultHeight={CHAT_BOTTOM_DOCK_DEFAULT_HEIGHT}
      fullscreenEnterLabel={t('common.enterFullscreen')}
      fullscreenExitLabel={t('common.exitFullscreen')}
      isOpen={isOpen}
      maxHeight={CHAT_BOTTOM_DOCK_MAX_HEIGHT}
      minHeight={CHAT_BOTTOM_DOCK_MIN_HEIGHT}
      title={
        <WorkspaceFileTabs
          activePath={path}
          paths={openPaths.length > 0 ? openPaths : [path]}
          onClosePath={onClosePath}
          onSelectPath={onSelectPath}
        />
      }
      closeLabel={t('common.close')}
      resizeLabel={t('chat.workspaceFileEditorResizePanel')}
      storageKey={CHAT_BOTTOM_DOCK_HEIGHT_STORAGE_KEY}
      onClose={onClose}
    >
      {isImagePreview && (
        <>
          <WorkspaceFileBreadcrumb path={path} />
          {imageLoadFailed
            ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('chat.workspaceImagePreviewLoadFailed')} />
            )
            : (
              <div className='workspace-file-editor__image-preview' data-dock-panel-no-resize='true'>
                <img src={imageUrl} alt={path} onError={() => setImageLoadFailed(true)} />
              </div>
            )}
        </>
      )}
      {!isImagePreview && isLoading && (
        <div className='workspace-file-editor__state'>
          <Spin size='small' />
          <span>{t('chat.workspaceFileEditorLoading')}</span>
        </div>
      )}
      {!isImagePreview && !isLoading && error != null && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('chat.workspaceFileEditorLoadFailed')} />
      )}
      {!isImagePreview && !isLoading && error == null && data != null && (
        <>
          <WorkspaceFileBreadcrumb path={data.path} />
          <div className='workspace-file-editor__editor' data-dock-panel-no-resize='true'>
            <Editor
              path={`workspace:///${data.path}`}
              value={draft}
              language={language}
              theme={themeName}
              loading={null}
              onChange={value => setDraft(value ?? '')}
              onMount={handleMount}
              options={{
                automaticLayout: true,
                contextmenu: true,
                folding: false,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 12,
                glyphMargin: false,
                lineDecorationsWidth: 2,
                lineHeight: 18,
                lineNumbersMinChars: 2,
                minimap: { enabled: false },
                overviewRulerBorder: false,
                padding: { top: 0, bottom: 10 },
                renderLineHighlight: 'line',
                scrollBeyondLastLine: false,
                scrollbar: {
                  alwaysConsumeMouseWheel: false,
                  useShadows: false
                },
                tabSize: 2,
                wordWrap: 'off'
              }}
            />
          </div>
        </>
      )}
    </DockPanel>
  )
}
