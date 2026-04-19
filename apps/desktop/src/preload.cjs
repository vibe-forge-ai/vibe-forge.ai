const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('vibeForgeDesktop', {
  platform: process.platform
})
