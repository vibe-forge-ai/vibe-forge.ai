import './styles/global.scss'
import './i18n'

import { ConfigProvider } from 'antd'
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
      <SWRConfig
        value={{
          fetcher: (path: string) => {
            const serverHost = import.meta.env.VITE_SERVER_HOST || window.location.hostname
            const serverPort = import.meta.env.VITE_SERVER_PORT || '8787'
            const baseUrl = `http://${serverHost}:${serverPort}`
            return fetch(`${baseUrl}${path}`).then((r) => r.json())
          }
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SWRConfig>
    </ConfigProvider>
  </React.StrictMode>
)
