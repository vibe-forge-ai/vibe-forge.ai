import './styles/global.scss'
import './i18n'

import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SWRConfig } from 'swr'

import { fetchApiJson } from '#~/api/base.js'

import App from './App'

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#000000' } }}>
      <AntdApp>
        <SWRConfig
          value={{
            fetcher: async (path: string) => fetchApiJson<unknown>(path)
          }}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SWRConfig>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
)
