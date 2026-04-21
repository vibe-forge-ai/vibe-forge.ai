const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const process = require('node:process')

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')

const { createWorkspaceSelectorHtml } = require('./workspace-selector-page.cjs')
const {
  getRecentWorkspaceFoldersFromState,
  getWorkspaceDescription,
  getWorkspaceDisplayName,
  getWorkspaceStorageKey,
  normalizeWorkspaceFolder,
  rememberRecentWorkspaceFolder,
  removeRecentWorkspaceFolder,
  resolveDesktopLaunchWorkspaceFolder
} = require('./workspace-state.cjs')

const SERVER_HOST = '127.0.0.1'
const CLIENT_BASE = '/ui'
const SERVER_READY_PATH = '/api/auth/status'
const SERVER_READY_TIMEOUT_MS = 30000
const SERVER_STOP_TIMEOUT_MS = 3000
const AUTO_UPDATE_CONFIG_FILES = ['app-update.yml', 'dev-app-update.yml']
const WORKSPACE_SELECTOR_STATE_CHANNEL = 'desktop:workspace-selector-state'

const isDev = !app.isPackaged
const repoRoot = path.resolve(__dirname, '../../..')
const serverChildPath = path.join(__dirname, 'server-child.cjs')

const runtimeState = {
  desktopState: {
    recentWorkspaces: []
  },
  pendingLaunchRequests: [],
  services: new Map(),
  windows: new Map()
}

let isQuitting = false

const initialWorkspaceFolder = resolveDesktopLaunchWorkspaceFolder({
  env: process.env,
  isDev,
  repoRoot
})

const ensureTrailingSlash = (value) => (
  typeof value === 'string' && value.endsWith('/') ? value : `${value}/`
)

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
  return {
    recentWorkspaces: getRecentWorkspaceFoldersFromState(state)
  }
}

const saveDesktopState = () => {
  writeJsonFile(getDesktopStatePath(), runtimeState.desktopState)
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

const isAutoUpdateDisabled = () => /^(?:0|false|no|off)$/i.test(process.env.VF_DESKTOP_AUTO_UPDATE ?? '')

const hasAutoUpdateConfig = () => (
  AUTO_UPDATE_CONFIG_FILES.some(fileName => fs.existsSync(path.join(process.resourcesPath, fileName)))
)

const buildWorkspaceWindowTitle = (workspaceFolder) => `${getWorkspaceDisplayName(workspaceFolder)} - Vibe Forge`
const buildWorkspaceSelectorWindowTitle = () => 'Choose Project - Vibe Forge'
const writeProcessLine = (stream, message) => {
  stream.write(`${String(message).replace(/[\r\n]+$/gu, '')}\n`)
}

const writePrefixedChunk = (stream, prefix, chunk) => {
  const output = String(chunk).replace(/[\r\n]+$/gu, '')
  if (output === '') {
    return
  }

  for (const line of output.split(/\r?\n/u)) {
    writeProcessLine(stream, `${prefix}${line}`)
  }
}

const loadDesktopStateIntoMemory = () => {
  runtimeState.desktopState = readDesktopState()
}

const getWindowRecords = () => Array.from(runtimeState.windows.values())

const findWindowRecord = (window) => (
  window == null ? undefined : runtimeState.windows.get(window.id)
)

const findWindowRecordForWebContents = (webContents) => (
  webContents == null ? undefined : findWindowRecord(BrowserWindow.fromWebContents(webContents))
)

const isWindowRecordUsable = (windowRecord) => (
  windowRecord != null &&
  windowRecord.window != null &&
  !windowRecord.window.isDestroyed()
)

const focusWindowRecord = (windowRecord) => {
  if (!isWindowRecordUsable(windowRecord)) return

  if (windowRecord.window.isMinimized()) {
    windowRecord.window.restore()
  }
  windowRecord.window.show()
  windowRecord.window.focus()
}

const findWorkspaceWindowRecord = (workspaceFolder) => (
  getWindowRecords().find(candidate => candidate.kind === 'workspace' && candidate.workspaceFolder === workspaceFolder)
)

const findReusableInitialSelectorWindowRecord = () => (
  getWindowRecords().find(candidate => candidate.kind === 'selector' && candidate.selectorMode === 'initial')
)

const findWorkspaceSelectorWindowRecord = (mode) => (
  getWindowRecords().find(candidate => candidate.kind === 'selector' && candidate.selectorMode === mode)
)

const getWorkspaceServiceDataPaths = (workspaceFolder) => {
  const workspaceDataRoot = path.join(app.getPath('userData'), 'workspaces', getWorkspaceStorageKey(workspaceFolder))
  return {
    dataDir: path.join(workspaceDataRoot, 'data'),
    dbPath: path.join(workspaceDataRoot, 'db.sqlite'),
    logDir: path.join(workspaceDataRoot, 'logs')
  }
}

const rememberWorkspaceFolder = (workspaceFolder) => {
  runtimeState.desktopState = {
    recentWorkspaces: rememberRecentWorkspaceFolder(
      runtimeState.desktopState.recentWorkspaces,
      workspaceFolder
    )
  }
  saveDesktopState()
  refreshAppMenu()
  broadcastWorkspaceSelectorState()
}

const forgetWorkspaceFolder = (workspaceFolder) => {
  runtimeState.desktopState = {
    recentWorkspaces: removeRecentWorkspaceFolder(
      runtimeState.desktopState.recentWorkspaces,
      workspaceFolder
    )
  }
  saveDesktopState()
  refreshAppMenu()
  broadcastWorkspaceSelectorState()
}

const listRunningWorkspaceServices = ({ currentWorkspaceFolder } = {}) => (
  Array.from(runtimeState.services.values())
    .sort((left, right) => {
      if (left.workspaceFolder === currentWorkspaceFolder) return -1
      if (right.workspaceFolder === currentWorkspaceFolder) return 1
      return left.displayName.localeCompare(right.displayName)
    })
    .map(service => ({
      description: service.description,
      isCurrent: service.workspaceFolder === currentWorkspaceFolder,
      name: service.displayName,
      status: service.status,
      workspaceFolder: service.workspaceFolder
    }))
)

const listRecentWorkspaceEntries = ({ currentWorkspaceFolder } = {}) => {
  const runningWorkspaceFolders = new Set(Array.from(runtimeState.services.keys()))
  return runtimeState.desktopState.recentWorkspaces
    .filter(workspaceFolder => workspaceFolder !== currentWorkspaceFolder)
    .filter(workspaceFolder => !runningWorkspaceFolders.has(workspaceFolder))
    .map(workspaceFolder => ({
      description: getWorkspaceDescription(workspaceFolder),
      name: getWorkspaceDisplayName(workspaceFolder),
      workspaceFolder
    }))
}

const buildWorkspaceSelectorState = (windowRecord) => ({
  recentProjects: listRecentWorkspaceEntries({
    currentWorkspaceFolder: windowRecord?.workspaceFolder
  }),
  runningProjects: listRunningWorkspaceServices({
    currentWorkspaceFolder: windowRecord?.workspaceFolder
  })
})

function broadcastWorkspaceSelectorState() {
  for (const windowRecord of getWindowRecords()) {
    if (windowRecord.kind !== 'selector' || !isWindowRecordUsable(windowRecord)) {
      continue
    }
    windowRecord.window.webContents.send(
      WORKSPACE_SELECTOR_STATE_CHANNEL,
      buildWorkspaceSelectorState(windowRecord)
    )
  }
}

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

  autoUpdater.autoDownload = !/^(?:0|false|no|off)$/i.test(process.env.VF_DESKTOP_AUTO_UPDATE_DOWNLOAD ?? '')
  autoUpdater.on('error', error => console.error('[vf-update] update check failed', error))
  autoUpdater.on(
    'update-available',
    info => writeProcessLine(process.stdout, `[vf-update] update available: ${info.version}`)
  )
  autoUpdater.on(
    'update-not-available',
    info => writeProcessLine(process.stdout, `[vf-update] already up to date: ${info.version}`)
  )
  autoUpdater.on('update-downloaded', (info) => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    dialog.showMessageBox(focusedWindow, {
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
    const retry = () => {
      if (Date.now() - startedAt > SERVER_READY_TIMEOUT_MS) {
        reject(new Error('Timed out while waiting for the Vibe Forge server.'))
        return
      }
      setTimeout(() => {
        waitForServerReady({ port, startedAt }).then(resolve, reject)
      }, 250)
    }

    const request = http.get({
      hostname: SERVER_HOST,
      path: SERVER_READY_PATH,
      port,
      timeout: 1000
    }, (response) => {
      response.resume()
      if ((response.statusCode ?? 500) < 500) {
        resolve()
        return
      }
      retry()
    })

    request.once('timeout', () => {
      request.destroy()
      retry()
    })

    request.once('error', retry)
  })

const waitForServerStartup = (child, port) =>
  new Promise((resolve, reject) => {
    let settled = false

    const settle = (callback, value) => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }

    function onError(error) {
      settle(reject, error)
    }

    function onExit(code, signal) {
      settle(
        reject,
        new Error(`Vibe Forge server exited before it was ready (code=${code ?? 'null'} signal=${signal ?? 'null'}).`)
      )
    }

    function cleanup() {
      child.off('error', onError)
      child.off('exit', onExit)
    }

    child.once('error', onError)
    child.once('exit', onExit)
    waitForServerReady({ port }).then(
      () => settle(resolve),
      error => settle(reject, error)
    )
  })

const waitForChildExit = (child, timeoutMs) =>
  new Promise((resolve) => {
    if (child == null || child.exitCode != null || child.signalCode != null) {
      resolve(true)
      return
    }

    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)

    function onExit() {
      clearTimeout(timer)
      resolve(true)
    }

    child.once('exit', onExit)
  })

const killChildProcess = async (child) => {
  if (child == null || child.exitCode != null || child.signalCode != null) {
    return
  }

  child.kill('SIGTERM')
  const exitedAfterSigterm = await waitForChildExit(child, SERVER_STOP_TIMEOUT_MS)
  if (exitedAfterSigterm) {
    return
  }

  child.kill('SIGKILL')
  await waitForChildExit(child, SERVER_STOP_TIMEOUT_MS)
}

const loadWorkspaceSelectorWindow = async (windowRecord, input = {}) => {
  if (!isWindowRecordUsable(windowRecord)) {
    return
  }

  windowRecord.currentServerUrl = undefined
  windowRecord.kind = 'selector'
  windowRecord.selectorMode = input.mode ?? windowRecord.selectorMode ?? 'dialog'
  windowRecord.workspaceFolder = undefined
  windowRecord.window.setTitle(buildWorkspaceSelectorWindowTitle())
  await windowRecord.window.loadURL(
    `data:text/html;charset=utf-8,${
      encodeURIComponent(createWorkspaceSelectorHtml({
        errorMessage: input.errorMessage,
        mode: windowRecord.selectorMode
      }))
    }`
  )
  broadcastWorkspaceSelectorState()
}

const loadLoadingScreen = (windowRecord, workspaceFolder) => {
  if (!isWindowRecordUsable(windowRecord)) return

  const workspaceLabel = getWorkspaceDisplayName(workspaceFolder)
  const workspacePath = getWorkspaceDescription(workspaceFolder)
  windowRecord.window.setTitle(buildWorkspaceWindowTitle(workspaceFolder))
  windowRecord.window.loadURL(
    `data:text/html;charset=utf-8,${
      encodeURIComponent(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${buildWorkspaceWindowTitle(workspaceFolder)}</title>
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
                max-width: 640px;
                padding: 32px;
              }
              h1 {
                font-size: 26px;
                font-weight: 650;
                margin: 0 0 12px;
              }
              p {
                color: #9ca3af;
                font-size: 14px;
                line-height: 1.6;
                margin: 0 0 8px;
              }
              code {
                color: #bfdbfe;
              }
            </style>
          </head>
          <body>
            <main>
              <h1>Starting ${workspaceLabel.replace(/[<>&"]/g, '')}</h1>
              <p><code>${workspacePath.replace(/[<>&"]/g, '')}</code></p>
            </main>
          </body>
        </html>
      `)
    }`
  )
}

const createWindowRecord = (input = {}) => {
  const selectorMode = input.selectorMode ?? 'dialog'
  const isSelectorWindow = input.kind === 'selector'
  const isInitialSelectorWindow = isSelectorWindow && selectorMode === 'initial'
  const window = new BrowserWindow({
    height: isInitialSelectorWindow ? 760 : isSelectorWindow ? 700 : 900,
    minHeight: isSelectorWindow ? 620 : 720,
    minWidth: isSelectorWindow ? 560 : 960,
    parent: input.parentWindow?.window,
    show: false,
    title: isSelectorWindow ? buildWorkspaceSelectorWindowTitle() : 'Vibe Forge',
    width: isInitialSelectorWindow ? 920 : isSelectorWindow ? 720 : 1280,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true
    }
  })

  const windowRecord = {
    currentServerUrl: undefined,
    kind: input.kind ?? 'workspace',
    selectorMode,
    window,
    workspaceFolder: undefined
  }

  runtimeState.windows.set(window.id, windowRecord)

  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show()
    }
  })

  window.on('closed', () => {
    runtimeState.windows.delete(window.id)
    if (windowRecord.kind === 'workspace' && windowRecord.workspaceFolder != null) {
      const hasOtherWorkspaceWindow = getWindowRecords()
        .some(candidate => candidate.kind === 'workspace' && candidate.workspaceFolder === windowRecord.workspaceFolder)
      if (!hasOtherWorkspaceWindow) {
        const service = runtimeState.services.get(windowRecord.workspaceFolder)
        if (service != null) {
          void stopWorkspaceService(service)
        }
      }
    }
    refreshAppMenu()
    broadcastWorkspaceSelectorState()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (windowRecord.currentServerUrl != null && url.startsWith(windowRecord.currentServerUrl)) {
      return { action: 'allow' }
    }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (windowRecord.currentServerUrl != null && url.startsWith(windowRecord.currentServerUrl)) {
      return
    }
    if (url.startsWith('data:text/html')) {
      return
    }
    event.preventDefault()
    void shell.openExternal(url)
  })

  return windowRecord
}

async function stopWorkspaceService(service) {
  if (service == null) return
  if (service.stopPromise != null) {
    await service.stopPromise
    return
  }

  service.stopping = true
  service.status = 'stopping'
  broadcastWorkspaceSelectorState()
  refreshAppMenu()

  service.stopPromise = (async () => {
    await killChildProcess(service.serverProcess)
    if (
      service.serverProcess != null && service.serverProcess.exitCode == null &&
      service.serverProcess.signalCode == null
    ) {
      service.stopping = false
      service.status = 'ready'
      service.stopPromise = undefined
      broadcastWorkspaceSelectorState()
      refreshAppMenu()
    }
  })()
  await service.stopPromise
}

const handleServiceExit = (service, code, signal) => {
  if (runtimeState.services.get(service.workspaceFolder) === service) {
    runtimeState.services.delete(service.workspaceFolder)
  }
  service.status = 'stopped'
  service.stopPromise = undefined
  broadcastWorkspaceSelectorState()
  refreshAppMenu()

  if (service.stopping || isQuitting) {
    return
  }

  const workspaceWindowRecord = findWorkspaceWindowRecord(service.workspaceFolder)
  if (workspaceWindowRecord != null) {
    void loadWorkspaceSelectorWindow(workspaceWindowRecord, {
      errorMessage: `The local service for ${service.displayName} stopped unexpectedly (code=${code ?? 'null'} signal=${
        signal ?? 'null'
      }).`,
      mode: 'dialog'
    })
  } else {
    console.error(`[vf-server] ${service.displayName} exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`)
  }
}

const ensureWorkspaceService = async (workspaceFolder) => {
  const existingService = runtimeState.services.get(workspaceFolder)
  if (existingService != null) {
    if (existingService.stopPromise != null) {
      await existingService.stopPromise
      return await ensureWorkspaceService(workspaceFolder)
    }
    return await existingService.startPromise
  }

  const service = {
    description: getWorkspaceDescription(workspaceFolder),
    displayName: getWorkspaceDisplayName(workspaceFolder),
    port: undefined,
    serverProcess: undefined,
    serverUrl: undefined,
    startPromise: undefined,
    status: 'starting',
    stopPromise: undefined,
    stopping: false,
    workspaceFolder
  }
  runtimeState.services.set(workspaceFolder, service)
  broadcastWorkspaceSelectorState()
  refreshAppMenu()

  service.startPromise = (async () => {
    const clientDistPath = resolveClientDistPath()
    if (clientDistPath == null) {
      throw new Error('Client dist was not found. Run `pnpm -C apps/desktop build:client` first.')
    }

    const port = await getAvailablePort()
    const serverExecutable = resolveServerExecutable()
    const workspaceServiceDataPaths = getWorkspaceServiceDataPaths(workspaceFolder)
    const child = spawn(serverExecutable, [serverChildPath], {
      cwd: workspaceFolder,
      env: {
        ...process.env,
        DB_PATH: workspaceServiceDataPaths.dbPath,
        ELECTRON_RUN_AS_NODE: serverExecutable === process.execPath ? '1' : process.env.ELECTRON_RUN_AS_NODE,
        __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder,
        __VF_PROJECT_AI_CLIENT_BASE__: CLIENT_BASE,
        __VF_PROJECT_AI_CLIENT_DIST_PATH__: clientDistPath,
        __VF_PROJECT_AI_CLIENT_MODE__: 'desktop',
        __VF_PROJECT_AI_SERVER_DATA_DIR__: workspaceServiceDataPaths.dataDir,
        __VF_PROJECT_AI_SERVER_HOST__: SERVER_HOST,
        __VF_PROJECT_AI_SERVER_LOG_DIR__: workspaceServiceDataPaths.logDir,
        __VF_PROJECT_AI_SERVER_PORT__: String(port),
        __VF_PROJECT_AI_WEB_AUTH_ENABLED__: 'false'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    service.port = port
    service.serverProcess = child

    child.stdout.on('data', data => writePrefixedChunk(process.stdout, `[vf-server:${service.displayName}] `, data))
    child.stderr.on('data', data => writePrefixedChunk(process.stderr, `[vf-server:${service.displayName}] `, data))
    child.once('exit', (code, signal) => {
      handleServiceExit(service, code, signal)
    })

    await waitForServerStartup(child, port)

    service.serverUrl = `http://${SERVER_HOST}:${port}${CLIENT_BASE}`
    service.status = 'ready'
    broadcastWorkspaceSelectorState()
    refreshAppMenu()
    return service
  })().catch(async (error) => {
    await stopWorkspaceService(service)
    throw error
  })

  return await service.startPromise
}

const loadWorkspaceInWindow = async (windowRecord, workspaceFolder) => {
  const normalizedWorkspaceFolder = normalizeWorkspaceFolder(workspaceFolder)
  if (normalizedWorkspaceFolder == null) {
    throw new Error('The selected workspace is no longer available.')
  }

  const previousSelectorMode = windowRecord.kind === 'selector' ? windowRecord.selectorMode : 'dialog'
  windowRecord.kind = 'workspace'
  windowRecord.selectorMode = undefined
  windowRecord.workspaceFolder = normalizedWorkspaceFolder
  windowRecord.currentServerUrl = undefined

  rememberWorkspaceFolder(normalizedWorkspaceFolder)
  loadLoadingScreen(windowRecord, normalizedWorkspaceFolder)

  try {
    const service = await ensureWorkspaceService(normalizedWorkspaceFolder)
    if (!isWindowRecordUsable(windowRecord)) {
      return
    }

    windowRecord.workspaceFolder = normalizedWorkspaceFolder
    windowRecord.currentServerUrl = service.serverUrl
    windowRecord.window.setTitle(buildWorkspaceWindowTitle(normalizedWorkspaceFolder))
    await windowRecord.window.loadURL(ensureTrailingSlash(service.serverUrl))
    focusWindowRecord(windowRecord)
  } catch (error) {
    if (!isWindowRecordUsable(windowRecord)) {
      return
    }
    await loadWorkspaceSelectorWindow(windowRecord, {
      errorMessage: error instanceof Error ? error.message : String(error),
      mode: previousSelectorMode === 'initial' ? 'initial' : 'dialog'
    })
  }
}

const openWorkspaceWindow = async (workspaceFolder, input = {}) => {
  const normalizedWorkspaceFolder = normalizeWorkspaceFolder(workspaceFolder)
  if (normalizedWorkspaceFolder == null) {
    forgetWorkspaceFolder(workspaceFolder)
    throw new Error('The selected workspace is no longer available.')
  }

  const existingWorkspaceWindowRecord = findWorkspaceWindowRecord(normalizedWorkspaceFolder)
  if (existingWorkspaceWindowRecord != null) {
    rememberWorkspaceFolder(normalizedWorkspaceFolder)
    focusWindowRecord(existingWorkspaceWindowRecord)
    return existingWorkspaceWindowRecord
  }

  const targetWindowRecord = input.targetWindowRecord ??
    findReusableInitialSelectorWindowRecord() ??
    createWindowRecord({ kind: 'workspace' })

  await loadWorkspaceInWindow(targetWindowRecord, normalizedWorkspaceFolder)
  return targetWindowRecord
}

const createWorkspaceSelectorWindow = async (input = {}) => {
  const existingSelectorWindowRecord = input.mode === 'dialog'
    ? findWorkspaceSelectorWindowRecord('dialog')
    : undefined
  if (existingSelectorWindowRecord != null) {
    focusWindowRecord(existingSelectorWindowRecord)
    return existingSelectorWindowRecord
  }

  const windowRecord = createWindowRecord({
    kind: 'selector',
    parentWindow: input.parentWindow,
    selectorMode: input.mode ?? 'dialog'
  })
  await loadWorkspaceSelectorWindow(windowRecord, {
    errorMessage: input.errorMessage,
    mode: input.mode
  })
  return windowRecord
}

const promptForWorkspaceFolder = async (windowRecord) => {
  const result = await dialog.showOpenDialog(windowRecord?.window, {
    properties: ['openDirectory'],
    title: 'Open Workspace'
  })
  if (result.canceled || result.filePaths[0] == null) {
    return undefined
  }
  return normalizeWorkspaceFolder(result.filePaths[0])
}

const openWorkspaceDialog = async (input = {}) => {
  const targetWindowRecord = input.targetWindowRecord
  const workspaceFolder = await promptForWorkspaceFolder(targetWindowRecord)
  if (workspaceFolder == null) {
    return undefined
  }

  if (input.reuseTargetWindow === true && targetWindowRecord != null) {
    await loadWorkspaceInWindow(targetWindowRecord, workspaceFolder)
    return workspaceFolder
  }

  await openWorkspaceWindow(workspaceFolder)
  return workspaceFolder
}

const buildWorkspaceMenuItems = () => {
  const recentWorkspaceItems = runtimeState.desktopState.recentWorkspaces.map(workspaceFolder => ({
    click: () => {
      void openWorkspaceWindow(workspaceFolder).catch(handleDesktopError)
    },
    label: getWorkspaceDisplayName(workspaceFolder),
    sublabel: getWorkspaceDescription(workspaceFolder)
  }))

  const runningWorkspaceItems = Array.from(runtimeState.services.values()).map(service => ({
    click: () => {
      void openWorkspaceWindow(service.workspaceFolder).catch(handleDesktopError)
    },
    label: service.displayName,
    sublabel: service.description
  }))

  return [
    {
      accelerator: 'CmdOrCtrl+O',
      click: () => {
        void openWorkspaceDialog().catch(handleDesktopError)
      },
      label: 'Open Workspace...'
    },
    {
      accelerator: 'CmdOrCtrl+Shift+O',
      click: () => {
        const parentWindow = findWindowRecord(BrowserWindow.getFocusedWindow())
        void createWorkspaceSelectorWindow({
          mode: 'dialog',
          parentWindow
        }).catch(handleDesktopError)
      },
      label: 'Switch Project...'
    },
    {
      enabled: recentWorkspaceItems.length > 0,
      label: 'Open Recent',
      submenu: recentWorkspaceItems.length > 0
        ? recentWorkspaceItems
        : [{ enabled: false, label: 'No recent projects' }]
    },
    {
      enabled: runningWorkspaceItems.length > 0,
      label: 'Running Projects',
      submenu: runningWorkspaceItems.length > 0
        ? runningWorkspaceItems
        : [{ enabled: false, label: 'No running projects' }]
    }
  ]
}

function refreshAppMenu() {
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
        ...buildWorkspaceMenuItems(),
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

function handleDesktopError(error) {
  const message = error instanceof Error ? error.message : String(error)
  dialog.showErrorBox('Vibe Forge failed to open the workspace', message)
}

const handleSecondInstance = (_event, _argv, _workingDirectory, additionalData) => {
  const workspaceFolder = normalizeWorkspaceFolder(additionalData?.workspaceFolder)
  const launchRequest = { workspaceFolder }

  if (!app.isReady()) {
    runtimeState.pendingLaunchRequests.push(launchRequest)
    return
  }

  if (workspaceFolder != null) {
    void openWorkspaceWindow(workspaceFolder).catch(handleDesktopError)
    return
  }

  const parentWindow = findWindowRecord(BrowserWindow.getFocusedWindow())
  void createWorkspaceSelectorWindow({
    mode: 'dialog',
    parentWindow
  }).catch(handleDesktopError)
}

const registerIpcHandlers = () => {
  ipcMain.handle('desktop:get-workspace-selector-state', (event) => (
    buildWorkspaceSelectorState(findWindowRecordForWebContents(event.sender))
  ))

  ipcMain.handle('desktop:choose-workspace', async (event) => {
    const windowRecord = findWindowRecordForWebContents(event.sender)
    return await promptForWorkspaceFolder(windowRecord)
  })

  ipcMain.handle('desktop:open-workspace', async (event, workspaceFolder) => {
    const windowRecord = findWindowRecordForWebContents(event.sender)
    if (windowRecord?.kind === 'selector' && windowRecord.selectorMode === 'initial') {
      await loadWorkspaceInWindow(windowRecord, workspaceFolder)
      return
    }

    await openWorkspaceWindow(workspaceFolder)
    if (windowRecord?.kind === 'selector' && isWindowRecordUsable(windowRecord)) {
      windowRecord.window.close()
    }
  })
}

const flushPendingLaunchRequests = async () => {
  const pendingLaunchRequests = [...runtimeState.pendingLaunchRequests]
  runtimeState.pendingLaunchRequests = []

  for (const launchRequest of pendingLaunchRequests) {
    if (launchRequest.workspaceFolder != null) {
      await openWorkspaceWindow(launchRequest.workspaceFolder)
      continue
    }

    await createWorkspaceSelectorWindow({ mode: 'dialog' })
  }
}

const startApp = async () => {
  loadDesktopStateIntoMemory()
  registerIpcHandlers()
  refreshAppMenu()

  if (initialWorkspaceFolder != null) {
    await openWorkspaceWindow(initialWorkspaceFolder)
  } else {
    await createWorkspaceSelectorWindow({ mode: 'initial' })
  }

  configureAutoUpdates()
  await flushPendingLaunchRequests()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length !== 0) {
      return
    }
    void createWorkspaceSelectorWindow({ mode: 'initial' }).catch(handleDesktopError)
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock({
  workspaceFolder: initialWorkspaceFolder ?? null
})

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', handleSecondInstance)

  app.whenReady().then(() => {
    void startApp().catch(handleDesktopError)
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
    for (const service of runtimeState.services.values()) {
      if (service.serverProcess != null && !service.serverProcess.killed) {
        service.serverProcess.kill('SIGTERM')
      }
    }
  })
}
