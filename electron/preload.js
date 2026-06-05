// Preload script - Secure bridge between main and renderer processes
// Uses contextBridge to expose safe APIs, NOT nodeIntegration

const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe 'electronAPI' object to the renderer (Vue app)
contextBridge.exposeInMainWorld('electronAPI', {
  // Open native folder selection dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Analyze a folder at the given path
  analyzeFolder: (folderPath) => ipcRenderer.invoke('folder:analyze', folderPath),

  // Get detailed info about a file
  getFileInfo: (filePath) => ipcRenderer.invoke('file:getInfo', filePath)
})