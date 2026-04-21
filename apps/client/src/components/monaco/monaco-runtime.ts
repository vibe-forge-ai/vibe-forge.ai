import { loader } from '@monaco-editor/react'
import * as monacoApi from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

type MonacoWorkerFactory = (_moduleId: string, label: string) => Worker

const createMonacoWorker: MonacoWorkerFactory = (_moduleId, label) => {
  if (label === 'json') {
    return new JsonWorker()
  }

  if (label === 'css' || label === 'scss' || label === 'less') {
    return new CssWorker()
  }

  if (label === 'html' || label === 'handlebars' || label === 'razor') {
    return new HtmlWorker()
  }

  if (label === 'typescript' || label === 'javascript') {
    return new TypeScriptWorker()
  }

  return new EditorWorker()
}

const monacoRuntime = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: MonacoWorkerFactory
  }
}

monacoRuntime.MonacoEnvironment = {
  ...monacoRuntime.MonacoEnvironment,
  getWorker: createMonacoWorker
}

loader.config({ monaco: monacoApi })

export { monacoApi }
