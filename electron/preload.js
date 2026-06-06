// Preload script - Secure bridge between main and renderer processes
// Uses contextBridge to expose safe APIs, NOT nodeIntegration

const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe 'electronAPI' object to the renderer (Vue app)
contextBridge.exposeInMainWorld('electronAPI', {
  onMainLog: (callback) => {
    ipcRenderer.on('main-log', (_, message) => callback(message));
  },
  
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
  openInExplorer: (folderPath) => ipcRenderer.invoke('folder:openInExplorer', folderPath),

  // ============== Cleaning API ==============

  // Get standard folders (Desktop, Documents, Downloads, Bac2026) with their contents
  getStandardFolders: () => ipcRenderer.invoke('cleaner:getStandardFolders'),

  // Scan a specific folder and return non-shortcut items
  scanFolder: (folderPath) => ipcRenderer.invoke('cleaner:scanFolder', folderPath),

  // Move items to recycle bin (trash)
  moveToTrash: (items) => ipcRenderer.invoke('cleaner:moveToTrash', items),

  // Permanently delete items
  permanentDelete: (items) => ipcRenderer.invoke('cleaner:permanentDelete', items),

  // Move items to a target folder
  moveToFolder: (items, targetDir) => ipcRenderer.invoke('cleaner:moveToFolder', items, targetDir),

  // Open a folder selection dialog for choosing a destination
  selectDestinationFolder: () => ipcRenderer.invoke('cleaner:selectDestinationFolder'),

  // Find duplicate shortcuts on the Desktop
  findDuplicateShortcuts: () => ipcRenderer.invoke('cleaner:findDuplicateShortcuts'),

  // Find duplicate files across configured folders (same name)
  findDuplicateFiles: () => ipcRenderer.invoke('cleaner:findDuplicateFiles'),

  // Delete specific duplicate shortcuts
  deleteShortcuts: (shortcutPaths) => ipcRenderer.invoke('cleaner:deleteShortcuts', shortcutPaths),

  // Check if the Recycle Bin is empty (returns { success, isEmpty, count })
  isRecycleBinEmpty: () => ipcRenderer.invoke('cleaner:isRecycleBinEmpty'),

  // Empty the entire Windows Recycle Bin
  emptyRecycleBin: () => ipcRenderer.invoke('cleaner:emptyRecycleBin'),

  // Archive selected items to a 7z file
  // If destDir is provided, saves directly there without a dialog
  archiveTo7z: (items, destDir) => ipcRenderer.invoke('cleaner:archiveTo7z', items, destDir),

  // ============== Configuration API ==============

  // Load folder configuration
  loadFolderConfig: () => ipcRenderer.invoke('config:load'),

  // Save folder configuration
  saveFolderConfig: (config) => ipcRenderer.invoke('config:save', JSON.parse(config) || { folders: [] }),

  // Get default configuration
  getDefaultFolderConfig: () => ipcRenderer.invoke('config:getDefaults'),

  // Validate a folder path or regex pattern
  validateFolderPath: (entry) => ipcRenderer.invoke('config:validatePath', entry)
})