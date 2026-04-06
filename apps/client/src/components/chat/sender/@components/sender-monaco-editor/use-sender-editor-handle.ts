import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'

import type { SenderEditorHandle, SenderEditorSelection } from '#~/components/chat/sender/@types/sender-editor'

import { getSelectionOffsets, toMonacoRange } from './monaco-runtime'

export const useSenderEditorHandle = ({
  editorRef,
  standaloneEditorRef,
  value,
  disabledRef
}: {
  editorRef: MutableRefObject<SenderEditorHandle | null>
  standaloneEditorRef: MutableRefObject<MonacoEditorNamespace.IStandaloneCodeEditor | null>
  value: string
  disabledRef: MutableRefObject<boolean>
}) => {
  useEffect(() => {
    editorRef.current = {
      focus: () => {
        standaloneEditorRef.current?.focus()
      },
      setSelection: (selection: SenderEditorSelection) => {
        const editor = standaloneEditorRef.current
        const model = editor?.getModel()

        if (editor == null || model == null) {
          return
        }

        editor.setSelection(toMonacoRange(model, selection.start, selection.end))
      },
      getSelection: () => {
        const editor = standaloneEditorRef.current

        return editor == null ? null : getSelectionOffsets(editor)
      },
      getValue: () => standaloneEditorRef.current?.getValue() ?? value,
      isDisabled: () => disabledRef.current
    }

    return () => {
      editorRef.current = null
    }
  }, [disabledRef, editorRef, standaloneEditorRef, value])
}
