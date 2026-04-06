import './SenderMonacoEditor.scss'

import Editor from '@monaco-editor/react'
import { useId } from 'react'
import type { MutableRefObject } from 'react'

import type { SessionInfo } from '@vibe-forge/types'

import type { SenderEditorHandle } from '#~/components/chat/sender/@types/sender-editor'
import type { SenderCompletionMatch, SenderTokenDecoration } from '#~/components/chat/sender/@utils/sender-completion'
import { FONT_SIZE, LINE_HEIGHT } from './monaco-runtime'
import { useSenderMonacoEditor } from './use-sender-monaco-editor'

export function SenderMonacoEditor({
  editorRef,
  sessionInfo,
  value,
  placeholder,
  disabled,
  sendShortcut,
  onSendShortcut,
  secondarySendShortcut,
  onSecondarySendShortcut,
  onInputChange,
  onCursorChange,
  onKeyDown,
  onPaste,
  resolveCompletionMatch,
  resolveTokenDecorations
}: {
  editorRef: MutableRefObject<SenderEditorHandle | null>
  sessionInfo?: SessionInfo | null
  value: string
  placeholder: string
  disabled: boolean
  sendShortcut: string
  onSendShortcut: () => void
  secondarySendShortcut?: string
  onSecondarySendShortcut?: () => void
  onInputChange: (value: string, cursorOffset: number | null) => void
  onCursorChange: (cursorOffset: number | null) => void
  onKeyDown: (event: KeyboardEvent) => void
  onPaste: (event: ClipboardEvent) => void | Promise<void>
  resolveCompletionMatch: (
    value: string,
    cursorOffset: number | null,
    sessionInfo?: SessionInfo | null
  ) => SenderCompletionMatch | null
  resolveTokenDecorations: (value: string) => SenderTokenDecoration[]
}) {
  const editorId = useId()
  const modelPath = `inmemory://vf-chat-sender/${editorId}.md`
  const {
    themeName,
    editorHeight,
    handleEditorMount
  } = useSenderMonacoEditor({
    editorRef,
    modelPath,
    value,
    disabled,
    sendShortcut,
    onSendShortcut,
    secondarySendShortcut,
    onSecondarySendShortcut,
    onInputChange,
    onCursorChange,
    onKeyDown,
    onPaste,
    sessionInfo,
    resolveCompletionMatch,
    resolveTokenDecorations
  })

  return (
    <div className='chat-input-monaco'>
      <div className='chat-input-monaco__editor' style={{ height: `${editorHeight}px` }}>
        <Editor
          path={modelPath}
          language='markdown'
          theme={themeName}
          value={value}
          loading={null}
          onMount={handleEditorMount}
          options={{
            ariaLabel: placeholder,
            automaticLayout: true,
            bracketPairColorization: { enabled: false },
            domReadOnly: disabled,
            folding: false,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: FONT_SIZE,
            glyphMargin: false,
            guides: {
              bracketPairs: false,
              highlightActiveBracketPair: false,
              indentation: false
            },
            hideCursorInOverviewRuler: true,
            lineDecorationsWidth: 0,
            lineHeight: LINE_HEIGHT,
            lineNumbers: 'off',
            lineNumbersMinChars: 0,
            matchBrackets: 'never',
            minimap: { enabled: false },
            occurrencesHighlight: 'off',
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            padding: { top: 0, bottom: 0 },
            placeholder,
            readOnly: disabled,
            renderFinalNewline: 'off',
            renderLineHighlight: 'none',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            selectionHighlight: false,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              horizontal: 'hidden',
              useShadows: false,
              vertical: 'hidden'
            },
            suggest: {
              preview: true,
              selectionMode: 'whenQuickSuggestion'
            },
            suggestOnTriggerCharacters: true,
            wordWrap: 'on',
            wordWrapColumn: 80,
            wrappingIndent: 'same'
          }}
        />
      </div>
    </div>
  )
}
