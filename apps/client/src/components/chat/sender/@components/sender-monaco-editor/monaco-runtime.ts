import { loader } from '@monaco-editor/react'
import type { IRange, editor as MonacoEditorNamespace, languages } from 'monaco-editor'
import * as monacoApi from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

import type { SessionInfo } from '@vibe-forge/types'

import type { SenderEditorSelection } from '#~/components/chat/sender/@types/sender-editor'
import type { SenderCompletionMatch } from '#~/components/chat/sender/@utils/sender-completion'

export const FONT_SIZE = 13
export const LINE_HEIGHT = 20
export const MIN_EDITOR_HEIGHT = LINE_HEIGHT
export const MAX_EDITOR_HEIGHT = LINE_HEIGHT * 10

const monacoRuntime = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: () => Worker
  }
}

if (monacoRuntime.MonacoEnvironment == null) {
  monacoRuntime.MonacoEnvironment = {
    getWorker: () => new EditorWorker()
  }
}

loader.config({ monaco: monacoApi })

export const clampEditorHeight = (height: number) =>
  Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, Math.ceil(height)))

export const toMonacoRange = (
  model: MonacoEditorNamespace.ITextModel,
  start: number,
  end: number
) => {
  const rangeStart = model.getPositionAt(start)
  const rangeEnd = model.getPositionAt(end)

  return new monacoApi.Range(rangeStart.lineNumber, rangeStart.column, rangeEnd.lineNumber, rangeEnd.column)
}

export const getSelectionOffsets = (
  editor: MonacoEditorNamespace.IStandaloneCodeEditor
): SenderEditorSelection | null => {
  const model = editor.getModel()
  const selection = editor.getSelection()

  if (model == null || selection == null) {
    return null
  }

  return {
    start: model.getOffsetAt(selection.getStartPosition()),
    end: model.getOffsetAt(selection.getEndPosition())
  }
}

export const registerSenderCompletionProvider = ({
  monaco,
  resolveCompletionMatch,
  sessionInfo
}: {
  monaco: typeof monacoApi
  resolveCompletionMatch: (
    value: string,
    cursorOffset: number | null,
    sessionInfo?: SessionInfo | null
  ) => SenderCompletionMatch | null
  sessionInfo?: SessionInfo | null
}) =>
  monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['/', '@', '#'],
    provideCompletionItems: (model, position) => {
      const cursorOffset = model.getOffsetAt(position)
      const match = resolveCompletionMatch(model.getValue(), cursorOffset, sessionInfo)

      if (match == null || match.items.length === 0) {
        return { suggestions: [] }
      }

      const replaceRange = toMonacoRange(model, match.replaceStart, match.cursorOffset)
      const suggestions: languages.CompletionItem[] = match.items.map((item) => ({
        label: item.label,
        kind: item.kind === 'command'
          ? monaco.languages.CompletionItemKind.Function
          : item.kind === 'agent'
          ? monaco.languages.CompletionItemKind.Interface
          : monaco.languages.CompletionItemKind.Keyword,
        insertText: `${item.value} `,
        range: replaceRange as IRange,
        filterText: `${match.trigger}${item.value}`,
        sortText: `0-${item.value.toLowerCase()}`
      }))

      return { suggestions }
    }
  })
