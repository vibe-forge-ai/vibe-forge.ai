import 'devicon/devicon.min.css'

import './styles/material-symbols-rounded.scss'
import './styles/global.scss'
import './i18n'

import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SWRConfig } from 'swr'

import { fetchApiJson } from '#~/api/base.js'
import { getClientBase, resolveDevDocumentTitle } from '#~/runtime-config.js'

import App from './App'

const root = createRoot(document.getElementById('root')!)

const clientBase = getClientBase()

document.title = resolveDevDocumentTitle(document.title, {
  isDev: import.meta.env.DEV,
  gitRef: import.meta.env.__VF_PROJECT_AI_DEV_GIT_REF__
})

root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#000000' } }}>
      <AntdApp>
        <SWRConfig
          value={{
            fetcher: async (path: string) => fetchApiJson<unknown>(path)
          }}
        >
          <BrowserRouter basename={clientBase}>
            <App />
          </BrowserRouter>
        </SWRConfig>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
)
