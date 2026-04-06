/* eslint-disable max-lines */
import type { SenderEditorHandle } from '#~/components/chat/sender/@types/sender-editor'
import type { SenderCompletionMatch, SenderTokenDecoration } from '#~/components/chat/sender/@utils/sender-completion'
import { isShortcutMatch } from '#~/utils/shortcutUtils'
import type { SessionInfo } from '@vibe-forge/types'
import type { IDisposable, editor as MonacoEditorNamespace } from 'monaco-editor'
import type { MutableRefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  MIN_EDITOR_HEIGHT,
  clampEditorHeight,
  getSelectionOffsets,
  registerSenderCompletionProvider,
  toMonacoRange
} from './monaco-runtime'
import { useSenderEditorHandle } from './use-sender-editor-handle'
import { useSenderMonacoTheme } from './use-sender-monaco-theme'

const hasPastedImageFile = (clipboardData?: DataTransfer | null) => {
  return Array.from(clipboardData?.items ?? [])
    .some(item => item.kind === 'file' && item.type.startsWith('image/'))
}

export const useSenderMonacoEditor = ({
  editorRef,
  modelPath,
  value,
  disabled,
  sendShortcut,
  onSendShortcut,
  onInputChange,
  onCursorChange,
  onKeyDown,
  onPaste,
  sessionInfo,
  resolveCompletionMatch,
  resolveTokenDecorations
}: {
  editorRef: MutableRefObject<SenderEditorHandle | null>
  modelPath: string
  value: string
  disabled: boolean
  sendShortcut: string
  onSendShortcut: () => void
  onInputChange: (value: string, cursorOffset: number | null) => void
  onCursorChange: (cursorOffset: number | null) => void
  onKeyDown: (event: KeyboardEvent) => void
  onPaste: (event: ClipboardEvent) => void | Promise<void>
  sessionInfo?: SessionInfo | null
  resolveCompletionMatch: (
    value: string,
    cursorOffset: number | null,
    sessionInfo?: SessionInfo | null
  ) => SenderCompletionMatch | null
  resolveTokenDecorations: (value: string) => SenderTokenDecoration[]
}) => {
  const themeName = useSenderMonacoTheme()
  const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT)
  const standaloneEditorRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<MonacoEditorNamespace.IEditorDecorationsCollection | null>(null)
  const disabledRef = useRef(disabled)
  const sendShortcutRef = useRef(sendShortcut)
  const onSendShortcutRef = useRef(onSendShortcut)
  const onInputChangeRef = useRef(onInputChange)
  const onCursorChangeRef = useRef(onCursorChange)
  const onKeyDownRef = useRef(onKeyDown)
  const onPasteRef = useRef(onPaste)
  const resolveCompletionMatchRef = useRef(resolveCompletionMatch)
  const resolveTokenDecorationsRef = useRef(resolveTokenDecorations)
  const sessionInfoRef = useRef(sessionInfo)

  disabledRef.current = disabled
  sendShortcutRef.current = sendShortcut
  onSendShortcutRef.current = onSendShortcut
  onInputChangeRef.current = onInputChange
  onCursorChangeRef.current = onCursorChange
  onKeyDownRef.current = onKeyDown
  onPasteRef.current = onPaste
  resolveCompletionMatchRef.current = resolveCompletionMatch
  resolveTokenDecorationsRef.current = resolveTokenDecorations
  sessionInfoRef.current = sessionInfo

  useSenderEditorHandle({ editorRef, standaloneEditorRef, value, disabledRef })

  useEffect(() => {
    standaloneEditorRef.current?.updateOptions({
      readOnly: disabled,
      domReadOnly: disabled
    })
  }, [disabled])

  const applyDecorations = () => {
    const editor = standaloneEditorRef.current
    const model = editor?.getModel()

    if (editor == null || model == null) {
      return
    }

    const nextDecorations = resolveTokenDecorationsRef.current(model.getValue()).map(({ start, end, className }) => ({
      range: toMonacoRange(model, start, end),
      options: { inlineClassName: className }
    }))

    if (decorationsRef.current == null) {
      decorationsRef.current = editor.createDecorationsCollection(nextDecorations)
      return
    }

    decorationsRef.current.set(nextDecorations)
  }

  useEffect(() => {
    applyDecorations()
  }, [value])

  useEffect(() => {
    return () => {
      const editor = standaloneEditorRef.current as
        | (MonacoEditorNamespace.IStandaloneCodeEditor & {
          __vfDispose?: () => void
        })
        | null

      editor?.__vfDispose?.()
      decorationsRef.current?.clear()
      decorationsRef.current = null
      standaloneEditorRef.current = null
    }
  }, [])

  const handleEditorMount = (
    editor: MonacoEditorNamespace.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor')
  ) => {
    standaloneEditorRef.current = editor
    setEditorHeight(clampEditorHeight(editor.getContentHeight()))
    applyDecorations()

    const disposables: IDisposable[] = [registerSenderCompletionProvider({
      monaco,
      resolveCompletionMatch: (nextValue, cursorOffset) =>
        resolveCompletionMatchRef.current(nextValue, cursorOffset, sessionInfoRef.current)
    })]
    const domNode = editor.getDomNode()

    if (domNode != null) {
      const inputTargets = Array.from(
        domNode.querySelectorAll<HTMLElement>('.native-edit-context, textarea.inputarea')
      )
      const shouldHandleImagePaste = (event: ClipboardEvent, requireFocus: boolean) => {
        if (!hasPastedImageFile(event.clipboardData)) {
          return false
        }

        if (!requireFocus) {
          return true
        }

        const activeElement = document.activeElement

        return editor.hasTextFocus() ||
          (activeElement != null && domNode.contains(activeElement)) ||
          (event.target instanceof Node && domNode.contains(event.target))
      }
      const handleImagePaste = (
        event: ClipboardEvent,
        { requireFocus, stopImmediately }: { requireFocus: boolean; stopImmediately: boolean }
      ) => {
        if (!shouldHandleImagePaste(event, requireFocus)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()

        if (stopImmediately) {
          event.stopImmediatePropagation()
        }

        void onPasteRef.current(event)
      }
      const handleDocumentPaste = (event: ClipboardEvent) => {
        if (!shouldHandleImagePaste(event, true)) {
          return
        }

        handleImagePaste(event, { requireFocus: true, stopImmediately: true })
      }
      const handleNativePaste: EventListener = (event) => {
        if (!(event instanceof ClipboardEvent)) {
          return
        }

        handleImagePaste(event, { requireFocus: false, stopImmediately: true })
      }
      const handleNativeKeyDown: EventListener = (event) => {
        if (!(event instanceof KeyboardEvent)) {
          return
        }
        if (isShortcutMatch(event, sendShortcutRef.current, navigator.platform.includes('Mac'))) {
          event.preventDefault()
          event.stopPropagation()
          onSendShortcutRef.current()
        }
      }

      document.addEventListener('paste', handleDocumentPaste, true)
      for (const inputTarget of inputTargets) {
        inputTarget.addEventListener('paste', handleNativePaste, true)
        inputTarget.addEventListener('keydown', handleNativeKeyDown, true)
      }
      disposables.push({
        dispose: () => {
          document.removeEventListener('paste', handleDocumentPaste, true)
          for (const inputTarget of inputTargets) {
            inputTarget.removeEventListener('paste', handleNativePaste, true)
            inputTarget.removeEventListener('keydown', handleNativeKeyDown, true)
          }
        }
      })
    }

    disposables.push(
      editor.onDidContentSizeChange(() => {
        setEditorHeight(clampEditorHeight(editor.getContentHeight()))
      }),
      editor.onDidChangeModelContent(() => {
        const cursorOffset = getSelectionOffsets(editor)?.end ?? null
        const nextValue = editor.getValue()

        onInputChangeRef.current(nextValue, cursorOffset)

        if (resolveCompletionMatchRef.current(nextValue, cursorOffset, sessionInfoRef.current) != null) {
          requestAnimationFrame(() => {
            if (standaloneEditorRef.current === editor) {
              editor.trigger('vf.sender', 'editor.action.triggerSuggest', {})
            }
          })
        }
      }),
      editor.onDidChangeCursorSelection(() => {
        onCursorChangeRef.current(getSelectionOffsets(editor)?.end ?? null)
      }),
      editor.onKeyDown((event) => {
        onKeyDownRef.current(event.browserEvent)
      })
    )
    ;(editor as MonacoEditorNamespace.IStandaloneCodeEditor & { __vfDispose?: () => void }).__vfDispose = () => {
      for (const item of disposables) {
        item.dispose()
      }
    }
  }

  return {
    themeName,
    editorHeight,
    handleEditorMount
  }
}
