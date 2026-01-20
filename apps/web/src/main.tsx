import './styles/global.scss'
import './i18n'

import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SWRConfig } from 'swr'

import App from './App'

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#000000' } }}>
      <AntdApp>
        <SWRConfig
          value={{
            fetcher: async (path: string) => {
              const serverHost = (import.meta.env.VITE_SERVER_HOST != null && import.meta.env.VITE_SERVER_HOST !== '')
                ? import.meta.env.VITE_SERVER_HOST
                : window.location.hostname
              const serverPort = (import.meta.env.VITE_SERVER_PORT != null && import.meta.env.VITE_SERVER_PORT !== '')
                ? import.meta.env.VITE_SERVER_PORT
                : '8787'
              const baseUrl = `http://${serverHost}:${serverPort}`
              return fetch(`${baseUrl}${path}`).then(async (r) => r.json() as Promise<unknown>)
            }
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
