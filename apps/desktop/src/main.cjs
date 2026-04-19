const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')

const { app, BrowserWindow, Menu, dialog, shell } = require('electron')

const SERVER_HOST = '127.0.0.1'
const CLIENT_BASE = '/ui'
const SERVER_READY_PATH = '/api/auth/status'
const SERVER_READY_TIMEOUT_MS = 30000
const AUTO_UPDATE_CONFIG_FILES = ['app-update.yml', 'dev-app-update.yml']

const isDev = !app.isPackaged
const repoRoot = path.resolve(__dirname, '../../..')
const serverChildPath = path.join(__dirname, 'server-child.cjs')

let mainWindow
let serverProcess
let currentServerUrl
let currentWorkspaceFolder
let isQuitting = false

const ensureTrailingSlash = (value) => (
  typeof value === 'string' && value.endsWith('/') ? value : `${value}/`
)

const isDirectory = (value) => {
  try {
    return fs.statSync(value).isDirectory()
  } catch {
    return false
  }
}

const readJsonFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return undefined
  }
}

const writeJsonFile = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

const getDesktopStatePath = () => path.join(app.getPath('userData'), 'desktop-state.json')

const readDesktopState = () => {
  const state = readJsonFile(getDesktopStatePath())
  return state != null && typeof state === 'object' ? state : {}
}

const saveWorkspaceFolder = (workspaceFolder) => {
  writeJsonFile(getDesktopStatePath(), {
    ...readDesktopState(),
    workspaceFolder
  })
}

const pickWorkspaceFolder = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const normalized = path.resolve(candidate)
    if (isDirectory(normalized)) {
      return normalized
    }
  }
  return undefined
}

const resolveInitialWorkspaceFolder = () => {
  const state = readDesktopState()
  const stateWorkspace = typeof state.workspaceFolder === 'string' ? state.workspaceFolder : undefined

  return pickWorkspaceFolder(
    process.env.VF_DESKTOP_WORKSPACE,
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
    stateWorkspace,
    process.env.INIT_CWD,
    isDev ? repoRoot : undefined,
    app.getPath('home')
  ) ?? os.homedir()
}

const resolveClientDistPath = () => {
  const candidates = app.isPackaged
    ? [
      path.join(process.resourcesPath, 'dist')
    ]
    : [
      path.join(repoRoot, 'apps/client/dist')
    ]

  return candidates.find(candidate => fs.existsSync(path.join(candidate, 'index.html')))
}

const resolveServerExecutable = () => {
  if (process.env.VF_DESKTOP_SERVER_RUNTIME != null && process.env.VF_DESKTOP_SERVER_RUNTIME.trim() !== '') {
    return process.env.VF_DESKTOP_SERVER_RUNTIME.trim()
  }

  return app.isPackaged ? process.execPath : 'node'
}

const isAutoUpdateDisabled = () => /^(0|false|no|off)$/i.test(process.env.VF_DESKTOP_AUTO_UPDATE ?? '')

const hasAutoUpdateConfig = () => (
  AUTO_UPDATE_CONFIG_FILES.some(fileName => fs.existsSync(path.join(process.resourcesPath, fileName)))
)

const configureAutoUpdates = () => {
  if (!app.isPackaged || isAutoUpdateDisabled() || !hasAutoUpdateConfig()) {
    return
  }

  let autoUpdater
  try {
    autoUpdater = require('electron-updater').autoUpdater
  } catch (error) {
    console.error('[vf-update] failed to load electron-updater', error)
    return
  }

  autoUpdater.autoDownload = !/^(0|false|no|off)$/i.test(process.env.VF_DESKTOP_AUTO_UPDATE_DOWNLOAD ?? '')
  autoUpdater.on('error', error => console.error('[vf-update] update check failed', error))
  autoUpdater.on('update-available', info => console.log(`[vf-update] update available: ${info.version}`))
  autoUpdater.on('update-not-available', info => console.log(`[vf-update] already up to date: ${info.version}`))
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      message: `Vibe Forge ${info.version} is ready to install.`,
      title: 'Update Ready',
      type: 'info'
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    }).catch(error => console.error('[vf-update] failed to show update dialog', error))
  })

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(error => console.error('[vf-update] update check failed', error))
  }, 2000)
}

const getAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', reject)
    server.listen(0, SERVER_HOST, () => {
      const address = server.address()
      server.close(() => {
        if (address == null || typeof address === 'string') {
          reject(new Error('Failed to allocate a local server port.'))
          return
        }
        resolve(address.port)
      })
    })
  })

const waitForServerReady = ({ port, startedAt = Date.now() }) =>
  new Promise((resolve, reject) => {
    const request = http.get({
      hostname: SERVER_HOST,
      port,
      path: SERVER_READY_PATH,
      timeout: 1000
    }, (response) => {
      response.resume()
      if ((response.statusCode ?? 500) < 500) {
        resolve()
        return
      }
      retry()
    })

    const retry = () => {
      if (Date.now() - startedAt > SERVER_READY_TIMEOUT_MS) {
        reject(new Error('Timed out while waiting for the Vibe Forge server.'))
        return
      }
      setTimeout(() => {
        waitForServerReady({ port, startedAt }).then(resolve, reject)
      }, 250)
    }

    request.once('timeout', () => {
      request.destroy()
      retry()
    })

    request.once('error', retry)
  })

const waitForServerStartup = (child, port) =>
  new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      child.off('error', onError)
      child.off('exit', onExit)
    }
    const settle = (callback, value) => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }
    const onError = error => settle(reject, error)
    const onExit = (code, signal) => {
      settle(
        reject,
        new Error(`Vibe Forge server exited before it was ready (code=${code ?? 'null'} signal=${signal ?? 'null'}).`)
      )
    }

    child.once('error', onError)
    child.once('exit', onExit)
    waitForServerReady({ port }).then(
      () => settle(resolve),
      error => settle(reject, error)
    )
  })

const stopServer = async () => {
  const child = serverProcess
  serverProcess = undefined
  currentServerUrl = undefined
  if (child == null || child.killed) {
    return
  }

  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL')
      }
      resolve()
    }, 3000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

const startServer = async (workspaceFolder) => {
  const clientDistPath = resolveClientDistPath()
  if (clientDistPath == null) {
    throw new Error('Client dist was not found. Run `pnpm -C apps/desktop build:client` first.')
  }

  await stopServer()

  const port = await getAvailablePort()
  const serverExecutable = resolveServerExecutable()
  const userDataDir = app.getPath('userData')
  const child = spawn(serverExecutable, [serverChildPath], {
    cwd: workspaceFolder,
    env: {
      ...process.env,
      DB_PATH: path.join(userDataDir, 'db.sqlite'),
      ELECTRON_RUN_AS_NODE: serverExecutable === process.execPath ? '1' : process.env.ELECTRON_RUN_AS_NODE,
      __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder,
      __VF_PROJECT_AI_CLIENT_BASE__: CLIENT_BASE,
      __VF_PROJECT_AI_CLIENT_DIST_PATH__: clientDistPath,
      __VF_PROJECT_AI_CLIENT_MODE__: 'desktop',
      __VF_PROJECT_AI_SERVER_DATA_DIR__: path.join(userDataDir, 'data'),
      __VF_PROJECT_AI_SERVER_HOST__: SERVER_HOST,
      __VF_PROJECT_AI_SERVER_LOG_DIR__: path.join(userDataDir, 'logs'),
      __VF_PROJECT_AI_SERVER_PORT__: String(port),
      __VF_PROJECT_AI_WEB_AUTH_ENABLED__: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  serverProcess = child
  currentWorkspaceFolder = workspaceFolder

  child.stdout.on('data', data => console.log(`[vf-server] ${String(data).trimEnd()}`))
  child.stderr.on('data', data => console.error(`[vf-server] ${String(data).trimEnd()}`))
  child.once('exit', (code, signal) => {
    if (serverProcess === child) {
      serverProcess = undefined
      currentServerUrl = undefined
    }
    if (!isQuitting) {
      console.error(`[vf-server] exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    }
  })

  await waitForServerStartup(child, port)

  currentServerUrl = `http://${SERVER_HOST}:${port}${CLIENT_BASE}`
  saveWorkspaceFolder(workspaceFolder)
  return currentServerUrl
}

const loadLoadingScreen = () => {
  if (mainWindow == null) return
  const workspaceLabel = currentWorkspaceFolder ?? 'workspace'
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${
      encodeURIComponent(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Vibe Forge</title>
            <style>
              body {
                align-items: center;
                background: #111827;
                color: #e5e7eb;
                display: flex;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                height: 100vh;
                justify-content: center;
                margin: 0;
              }
              main {
                max-width: 620px;
                padding: 32px;
              }
              h1 {
                font-size: 24px;
                font-weight: 650;
                margin: 0 0 12px;
              }
              p {
                color: #9ca3af;
                font-size: 14px;
                line-height: 1.6;
                margin: 0;
              }
              code {
                color: #bfdbfe;
              }
            </style>
          </head>
          <body>
            <main>
              <h1>Starting Vibe Forge</h1>
              <p>Workspace: <code>${workspaceLabel.replace(/[<>&"]/g, '')}</code></p>
            </main>
          </body>
        </html>
      `)
    }`
  )
}

const showStartupError = (error) => {
  const message = error instanceof Error ? error.message : String(error)
  dialog.showErrorBox('Vibe Forge failed to start', message)
  if (mainWindow != null) {
    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${
        encodeURIComponent(`
          <!doctype html>
          <html>
            <head><meta charset="utf-8" /><title>Vibe Forge</title></head>
            <body style="font-family: sans-serif; padding: 32px;">
              <h1>Vibe Forge failed to start</h1>
              <pre style="white-space: pre-wrap;">${message.replace(/[<>&]/g, '')}</pre>
            </body>
          </html>
        `)
      }`
    )
  }
}

const loadWorkspace = async (workspaceFolder) => {
  currentWorkspaceFolder = workspaceFolder
  loadLoadingScreen()
  try {
    const url = await startServer(workspaceFolder)
    await mainWindow.loadURL(ensureTrailingSlash(url))
  } catch (error) {
    showStartupError(error)
  }
}

const selectWorkspaceAndRestart = async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Workspace',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths[0] == null) {
    return
  }
  await loadWorkspace(result.filePaths[0])
}

const createAppMenu = () => {
  const template = [
    ...(process.platform === 'darwin'
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Workspace...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            void selectWorkspaceAndRestart()
          }
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    height: 900,
    minHeight: 720,
    minWidth: 960,
    show: false,
    title: 'Vibe Forge',
    width: 1280,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (currentServerUrl != null && url.startsWith(currentServerUrl)) {
      return { action: 'allow' }
    }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (currentServerUrl != null && url.startsWith(currentServerUrl)) {
      return
    }
    if (url.startsWith('data:text/html')) {
      return
    }
    event.preventDefault()
    void shell.openExternal(url)
  })
}

app.whenReady().then(async () => {
  createAppMenu()
  createWindow()
  await loadWorkspace(resolveInitialWorkspaceFolder())
  configureAutoUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      void loadWorkspace(currentWorkspaceFolder ?? resolveInitialWorkspaceFolder())
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  if (serverProcess != null && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
  }
})
