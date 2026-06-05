// Preload script - Secure bridge between main and renderer processes
// Uses contextBridge to expose safe APIs, NOT nodeIntegration

const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe 'electronAPI' object to the renderer (Vue app)
contextBridge.exposeInMainWorld('electronAPI', {
  // Open native folder selection dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Analyze a folder at the given path (synchronous, small folders)
  analyzeFolder: (folderPath) => ipcRenderer.invoke('folder:analyze', folderPath),

  // Analyze a folder asynchronously with progress events (large folders)
  // Listens for 'scan:progress' events from main process
  analyzeFolderAsync: (folderPath) => {
    return ipcRenderer.invoke('folder:analyzeAsync', folderPath)
  },

  // Listen for scan progress updates
  onScanProgress: (callback) => {
    const handler = (_event, message) => callback(message)
    ipcRenderer.on('scan:progress', handler)
    // Return cleanup function
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },

  // Cancel a running folder scan
  cancelScan: () => ipcRenderer.invoke('folder:cancelScan'),

  // Get detailed info about a file
  getFileInfo: (filePath) => ipcRenderer.invoke('file:getInfo', filePath),

  // Open a file with the default system application
  openInSystem: (filePath) => ipcRenderer.invoke('file:openInSystem', filePath),

  // Open a folder in the system file explorer
  openInExplorer: (folderPath) => ipcRenderer.invoke('folder:openInExplorer', folderPath)
})