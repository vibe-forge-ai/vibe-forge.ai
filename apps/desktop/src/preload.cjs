const process = require('node:process')
const { contextBridge, ipcRenderer } = require('electron')

const selectorStateChannel = 'desktop:workspace-selector-state'

contextBridge.exposeInMainWorld('vibeForgeDesktop', {
  chooseWorkspace: () => ipcRenderer.invoke('desktop:choose-workspace'),
  getWorkspaceSelectorState: () => ipcRenderer.invoke('desktop:get-workspace-selector-state'),
  onWorkspaceSelectorStateChange: (listener) => {
    const wrappedListener = (_event, value) => {
      listener(value)
    }
    ipcRenderer.on(selectorStateChannel, wrappedListener)
    return () => {
      ipcRenderer.off(selectorStateChannel, wrappedListener)
    }
  },
  openWorkspace: (workspaceFolder) => ipcRenderer.invoke('desktop:open-workspace', workspaceFolder),
  platform: process.platform
})
