import { randomBytes } from 'node:crypto'

import type * as vscode from 'vscode'

import { SERVER_HOST } from './constants'
import type { ManagedServer } from './server-manager'
import { escapeHtml } from './utils'

const pageChromeStyles = `
  body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); margin: 0; }
  h1 { font-size: 20px; font-weight: 650; margin: 0 0 8px; }
`

export const createStatusHtml = (title: string, detail: string) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${pageChromeStyles}
        body { align-items: center; display: flex; height: 100vh; justify-content: center; }
        main { line-height: 1.6; max-width: 640px; padding: 24px; }
        p { color: var(--vscode-descriptionForeground); margin: 0; }
      </style>
    </head>
    <body>
      <main>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(detail)}</p>
      </main>
    </body>
  </html>
`

export const createLoadingHtml = (workspaceFolder: vscode.WorkspaceFolder) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${pageChromeStyles}
        body { align-items: center; display: flex; height: 100vh; justify-content: center; }
        main { line-height: 1.6; max-width: 640px; padding: 32px; }
        p { color: var(--vscode-descriptionForeground); margin: 0; }
      </style>
    </head>
    <body>
      <main>
        <h1>Starting Vibe Forge</h1>
        <p>${escapeHtml(workspaceFolder.uri.fsPath)}</p>
      </main>
    </body>
  </html>
`

export const createErrorHtml = (message: string) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${pageChromeStyles}
        body { padding: 32px; }
        pre {
          background: var(--vscode-textBlockQuote-background);
          border-radius: 6px;
          overflow: auto;
          padding: 16px;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <h1>Vibe Forge failed to start</h1>
      <pre>${escapeHtml(message)}</pre>
    </body>
  </html>
`

const createFrameStyles = () => `
  html, body, iframe { height: 100%; margin: 0; padding: 0; width: 100%; }
  body { background: var(--vscode-editor-background); overflow: hidden; }
  iframe { border: 0; display: block; }
`

export const createWebviewHtml = (webview: vscode.Webview, server: ManagedServer) => {
  const nonce = randomBytes(16).toString('base64')
  const frameOrigin = `http://${SERVER_HOST}:${server.port}`
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; frame-src ${frameOrigin}; img-src ${webview.cspSource} data: https:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
        >
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${createFrameStyles()}</style>
      </head>
      <body>
        <iframe
          allow="clipboard-read; clipboard-write"
          sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
          src="${escapeHtml(server.url)}"
          title="Vibe Forge"
        ></iframe>
        <script nonce="${nonce}">acquireVsCodeApi()</script>
      </body>
    </html>
  `
}
