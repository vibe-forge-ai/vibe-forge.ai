import Editor, { loader } from '@monaco-editor/react'
import { Button, Tooltip } from 'antd'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import * as monacoApi from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { useEffect, useState } from 'react'

import type { WorktreeEnvironmentScriptKey } from '@vibe-forge/types'

import type { TranslationFn } from './configUtils'
import { getScriptLanguage } from './worktree-environment-panel-model'

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

const scriptEnvVars = [
  'VF_WORKTREE_ENV',
  'VF_WORKTREE_OPERATION',
  'VF_WORKTREE_PATH',
  'VF_SESSION_ID',
  'VF_WORKTREE_SOURCE_PATH',
  'VF_REPOSITORY_ROOT',
  'VF_WORKTREE_BASE_REF',
  'VF_WORKTREE_FORCE'
]

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

export function WorktreeEnvironmentScriptEditorCard({
  scriptKey,
  value,
  title,
  description,
  onChange,
  t
}: {
  scriptKey: WorktreeEnvironmentScriptKey
  value: string
  title: string
  description?: string
  onChange: (key: WorktreeEnvironmentScriptKey, content: string) => void
  t: TranslationFn
}) {
  const themeName = useMonacoTheme()

  return (
    <div className='worktree-env-panel__script-card'>
      <div className='worktree-env-panel__script-card-header'>
        <div>
          <div className='worktree-env-panel__script-card-title'>{title}</div>
          {description != null && description !== '' && (
            <div className='worktree-env-panel__script-card-desc'>{description}</div>
          )}
        </div>
        <div className='worktree-env-panel__script-card-actions'>
          <Tooltip title={scriptEnvVars.join('\n')}>
            <Button type='text' size='small'>
              {t('config.environments.availableEnvVars')}
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className='worktree-env-panel__monaco'>
        <Editor
          value={value}
          language={getScriptLanguage(scriptKey)}
          theme={themeName}
          loading={null}
          onChange={(nextValue) => onChange(scriptKey, nextValue ?? '')}
          options={{
            automaticLayout: true,
            contextmenu: true,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 12,
            glyphMargin: false,
            lineDecorationsWidth: 8,
            lineHeight: 18,
            minimap: { enabled: false },
            overviewRulerBorder: false,
            renderLineHighlight: 'line',
            scrollBeyondLastLine: false,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              useShadows: false
            },
            tabSize: 2,
            wordWrap: 'on'
          } satisfies MonacoEditorNamespace.IStandaloneEditorConstructionOptions}
        />
      </div>
    </div>
  )
}
