// Electron main process
// Handles filesystem access and IPC communication with the renderer
// Supports async scanning with progress and cancellation for large folders

const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow = null
let currentScanAbort = false

/**
 * Creates the main application window
 * Uses contextIsolation and preload script for security
 */
function createWindow() {
  // Icon path for the application window
  const iconPath = path.join(__dirname, '..', 'build', 'icon.svg')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,    // Security: isolate renderer process
      nodeIntegration: false,    // Security: disable Node.js in renderer
      preload: path.join(__dirname, 'preload.js') // Secure bridge
    }
  })

  // In development, load from Vite dev server; in production, load built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

/**
 * Recursively scan a directory and build a tree structure
 * Reports progress via callback for large folders
 * Respects the abort flag for cancellation
 *
 * Returns: { name, path, type, size, children[], modifiedAt }
 */
function scanDirectory(dirPath, depth = 0, progressCb = null, maxDepth = 100) {
  // Check for cancellation
  if (currentScanAbort) {
    throw new Error('canceled')
  }

  const stats = fs.statSync(dirPath)
  const name = path.basename(dirPath)

  // Base info for the current item
  const item = {
    name,
    path: dirPath,
    type: stats.isDirectory() ? 'folder' : 'file',
    size: stats.isFile() ? stats.size : 0,
    modifiedAt: stats.mtime.toISOString(),
    children: []
  }

  // If it's a directory, recursively scan its contents
  if (stats.isDirectory() && depth < maxDepth) {
    try {
      const entries = fs.readdirSync(dirPath)

      // Report progress periodically
      if (progressCb && depth < 3) {
        progressCb(`Scanning: ${name} (${entries.length} items)`)
      }

      for (const entry of entries) {
        // Check cancellation between entries
        if (currentScanAbort) {
          throw new Error('canceled')
        }

        // Skip hidden files and system folders
        if (entry.startsWith('.')) continue

        const childPath = path.join(dirPath, entry)
        try {
          const childItem = scanDirectory(childPath, depth + 1, progressCb, maxDepth)
          item.children.push(childItem)
        } catch (err) {
          if (err.message === 'canceled') throw err
          // Skip files/directories we can't access
          console.warn(`Cannot access ${childPath}: ${err.message}`)
        }
      }

      // Sort: folders first, then alphabetically
      item.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    } catch (err) {
      if (err.message === 'canceled') throw err
      console.warn(`Cannot read directory ${dirPath}: ${err.message}`)
    }
  }

  return item
}

/**
 * Analyze a folder and return summary statistics
 */
function analyzeFolder(dirPath, progressCb = null) {
  const tree = scanDirectory(dirPath, 0, progressCb)

  // Calculate total stats by walking the tree
  function calculateStats(node) {
    let totalFiles = 0
    let totalFolders = 0
    let totalSize = 0

    if (node.type === 'folder') {
      totalFolders++
    } else {
      totalFiles++
      totalSize += node.size
    }

    for (const child of node.children) {
      const childStats = calculateStats(child)
      totalFiles += childStats.totalFiles
      totalFolders += childStats.totalFolders
      totalSize += childStats.totalSize
    }

    return { totalFiles, totalFolders, totalSize }
  }

  const stats = calculateStats(tree)
  return { tree, stats }
}

/**
 * Format file size to human-readable string
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

// IPC Handlers - securely expose filesystem operations to renderer

/**
 * Opens a native folder selection dialog
 */
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select a folder to analyze'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

/**
 * Synchronous folder analysis (for small folders)
 * Returns the full tree structure with stats
 */
ipcMain.handle('folder:analyze', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Path does not exist: ${folderPath}`)
    }
    return analyzeFolder(folderPath)
  } catch (err) {
    console.error('Folder analysis failed:', err.message)
    throw err
  }
})

/**
 * Asynchronous folder analysis with progress reporting
 * Uses IPC events to send progress updates during scan
 * Supports cancellation via cancelScan handler
 */
ipcMain.handle('folder:analyzeAsync', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Path does not exist: ${folderPath}`)
    }

    // Reset abort flag for new scan
    currentScanAbort = false

    // Create a progress callback that sends updates to renderer
    const progressCb = (message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan:progress', message)
      }
    }

    // Run analysis with progress
    const result = analyzeFolder(folderPath, progressCb)

    // Check if was cancelled during scan
    if (currentScanAbort) {
      throw new Error('canceled')
    }

    return result
  } catch (err) {
    if (err.message === 'canceled') {
      throw err
    }
    console.error('Folder analysis failed:', err.message)
    throw err
  }
})

/**
 * Cancel a running folder scan
 */
ipcMain.handle('folder:cancelScan', async () => {
  currentScanAbort = true
  return true
})

/**
 * Returns detailed info about a file
 */
ipcMain.handle('file:getInfo', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath)
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      formattedSize: formatSize(stats.size),
      modifiedAt: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory()
    }
  } catch (err) {
    console.error('File info failed:', err.message)
    throw err
  }
})

/**
 * Open a file with the default system application
 */
ipcMain.handle('file:openInSystem', async (event, filePath) => {
  try {
    const { shell } = require('electron')
    await shell.openPath(filePath)
    return true
  } catch (err) {
    console.error('Failed to open file:', err.message)
    throw err
  }
})

/**
 * Open a folder in the system file explorer
 */
ipcMain.handle('folder:openInExplorer', async (event, folderPath) => {
  try {
    const { shell } = require('electron')
    await shell.openPath(folderPath)
    return true
  } catch (err) {
    console.error('Failed to open folder:', err.message)
    throw err
  }
})

// App lifecycle
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On Windows/Linux, quit when all windows closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})