import './ToolDiffViewer.scss'

import { DiffEditor, loader } from '@monaco-editor/react'
import { Tooltip } from 'antd'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import * as monacoApi from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import React, { useEffect, useMemo, useState } from 'react'

import { TOOL_TOOLTIP_PROPS } from './tool-display'

const DIFF_LINE_HEIGHT = 18
const MIN_DIFF_HEIGHT = 96
const MAX_DIFF_HEIGHT = 360

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

const getThemeName = () => (document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs')

const getEditorHeight = (original: string, modified: string) => {
  const lineCount = Math.max(
    original === '' ? 1 : original.split('\n').length,
    modified === '' ? 1 : modified.split('\n').length
  )

  return Math.min(MAX_DIFF_HEIGHT, Math.max(MIN_DIFF_HEIGHT, lineCount * DIFF_LINE_HEIGHT + 28))
}

const getModeIcon = (mode: 'split' | 'inline') => (
  <span className='material-symbols-rounded'>
    {mode === 'split' ? 'splitscreen_right' : 'view_agenda'}
  </span>
)

export interface ToolDiffMetaItem {
  icon?: string
  label: string
  value?: string
  tone?: 'default' | 'success' | 'muted'
}

function useMonacoTheme() {
  const [themeName, setThemeName] = useState(getThemeName)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeName(getThemeName())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return themeName
}

export function ToolDiffViewer({
  original,
  modified,
  language,
  metaItems = [],
  splitLabel,
  inlineLabel
}: {
  original: string
  modified: string
  language?: string
  metaItems?: ToolDiffMetaItem[]
  splitLabel: string
  inlineLabel: string
}) {
  const [viewMode, setViewMode] = useState<'split' | 'inline'>('split')
  const themeName = useMonacoTheme()
  const height = useMemo(() => getEditorHeight(original, modified), [modified, original])

  return (
    <div className='tool-diff-viewer'>
      <div className='tool-diff-viewer__toolbar'>
        <div className='tool-diff-viewer__legend'>
          {metaItems.map(item => (
            <span
              key={`${item.label}-${item.value ?? ''}`}
              className={`tool-diff-viewer__meta-item ${item.tone != null ? `tool-diff-viewer__meta-item--${item.tone}` : ''}`}
            >
              {item.icon != null && item.icon !== '' && (
                <span className='material-symbols-rounded'>{item.icon}</span>
              )}
              <span className='tool-diff-viewer__meta-label'>{item.label}</span>
              {item.value != null && item.value !== '' && (
                <span className='tool-diff-viewer__meta-value'>{item.value}</span>
              )}
            </span>
          ))}
          {language != null && language !== '' && (
            <span className='tool-diff-viewer__lang'>{language}</span>
          )}
        </div>

        <div className='tool-diff-viewer__mode-switch' role='tablist' aria-label='Diff view mode'>
          {(['split', 'inline'] as const).map(mode => {
            const label = mode === 'split' ? splitLabel : inlineLabel
            return (
              <Tooltip key={mode} title={label} {...TOOL_TOOLTIP_PROPS}>
                <button
                  type='button'
                  className={`tool-diff-viewer__mode-button ${viewMode === mode ? 'is-active' : ''}`}
                  aria-label={label}
                  aria-pressed={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                >
                  {getModeIcon(mode)}
                </button>
              </Tooltip>
            )
          })}
        </div>
      </div>

      <div
        className='tool-diff-viewer__editor'
        style={{ height: `${height}px` }}
        aria-label='tool diff viewer'
      >
        <DiffEditor
          original={original}
          modified={modified}
          originalLanguage={language ?? 'text'}
          modifiedLanguage={language ?? 'text'}
          theme={themeName}
          loading={null}
          options={{
            automaticLayout: true,
            contextmenu: false,
            diffCodeLens: false,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 12,
            glyphMargin: false,
            hideUnchangedRegions: { enabled: false },
            lineDecorationsWidth: 8,
            lineHeight: DIFF_LINE_HEIGHT,
            minimap: { enabled: false },
            originalEditable: false,
            overviewRulerBorder: false,
            readOnly: true,
            renderIndicators: true,
            renderMarginRevertIcon: false,
            renderOverviewRuler: false,
            renderSideBySide: viewMode === 'split',
            scrollBeyondLastLine: false,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              useShadows: false
            },
            wordWrap: 'on'
          } satisfies MonacoEditorNamespace.IDiffEditorConstructionOptions}
        />
      </div>
    </div>
  )
}
