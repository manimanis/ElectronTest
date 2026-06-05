// Electron main process
// Handles filesystem access and IPC communication with the renderer
// Supports async scanning with progress and cancellation for large folders

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

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

/**
 * Get the list of standard user folders to clean
 */
function getStandardFolders() {
  const homeDir = os.homedir()
  const desktop = path.join(homeDir, 'Desktop')
  const documents = path.join(homeDir, 'Documents')
  const downloads = path.join(homeDir, 'Downloads')
  const bac2026 = path.join(desktop, 'Bac2026')

  const folders = [
    { name: 'Desktop', path: desktop },
    { name: 'Documents', path: documents },
    { name: 'Downloads', path: downloads }
  ]

  // Only add Bac2026 if it exists
  if (fs.existsSync(bac2026)) {
    folders.push({ name: 'Bac2026', path: bac2026 })
  }

  return folders
}

/**
 * Check if a file is a shortcut (.lnk on Windows)
 */
function isShortcut(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.lnk'
}

/**
 * Check if a file is a shortcut by its symlink attribute or .lnk extension
 */
function isShortcutOrSymlink(filePath) {
  // .lnk files are Windows shortcuts
  if (isShortcut(filePath)) return true
  try {
    const stats = fs.lstatSync(filePath)
    return stats.isSymbolicLink()
  } catch (e) {
    return false
  }
}

/**
 * Get a list of .lnk files in a folder and resolve their targets
 * to identify duplicates
 */
function getShortcutTargets(folderPath) {
  const shortcuts = []
  try {
    const entries = fs.readdirSync(folderPath)
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry)
      if (isShortcut(fullPath)) {
        // On Windows, we resolve the .lnk target via shell
        try {
          const stats = fs.statSync(fullPath)
          shortcuts.push({
            path: fullPath,
            name: entry,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
            // We'll use the file name (without .lnk) as a proxy for the target
            targetName: path.basename(entry, '.lnk').toLowerCase()
          })
        } catch (e) {
          // Skip inaccessible shortcuts
        }
      }
    }
  } catch (e) {
    console.warn(`Cannot read shortcuts from ${folderPath}: ${e.message}`)
  }
  return shortcuts
}

/**
 * Find duplicate shortcuts (same target application name) on the Desktop
 */
function findDuplicateShortcuts(desktopPath) {
  const shortcuts = getShortcutTargets(desktopPath)

  // Group shortcuts by target name
  const grouped = {}
  for (const sc of shortcuts) {
    if (!grouped[sc.targetName]) {
      grouped[sc.targetName] = []
    }
    grouped[sc.targetName].push(sc)
  }

  // Find groups with more than one shortcut (duplicates)
  const duplicates = []
  for (const [target, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      // Keep the first one (by modified date), mark the rest as duplicates
      items.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
      for (let i = 1; i < items.length; i++) {
        duplicates.push(items[i])
      }
    }
  }

  return duplicates
}

/**
 * Scan a folder and return non-shortcut files (with their sizes)
 */
function scanFolderForCleaning(folderPath) {
  const items = []
  try {
    const entries = fs.readdirSync(folderPath)
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry)
      try {
        const stats = fs.statSync(fullPath)
        // Skip shortcuts (.lnk files) as per requirements
        if (isShortcutOrSymlink(fullPath)) continue

        items.push({
          name: entry,
          path: fullPath,
          size: stats.size,
          formattedSize: formatSize(stats.size),
          modifiedAt: stats.mtime.toISOString(),
          isDirectory: stats.isDirectory()
        })
      } catch (e) {
        // Skip inaccessible items
      }
    }
  } catch (e) {
    console.warn(`Cannot scan ${folderPath}: ${e.message}`)
  }

  // Sort: folders first, then alphabetically
  items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return items
}

/**
 * Move file/folder to trash (recycle bin)
 */
async function moveToTrash(filePath) {
  try {
    await shell.trashItem(filePath)
    return { success: true, message: `Moved to trash: ${path.basename(filePath)}` }
  } catch (err) {
    return { success: false, message: `Failed to move to trash: ${err.message}` }
  }
}

/**
 * Permanently delete a file or folder
 */
function permanentDelete(filePath) {
  try {
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(filePath)
    }
    return { success: true, message: `Deleted permanently: ${path.basename(filePath)}` }
  } catch (err) {
    return { success: false, message: `Failed to delete: ${err.message}` }
  }
}

/**
 * Move a file or folder to a target directory
 */
function moveToFolder(filePath, targetDir) {
  try {
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const fileName = path.basename(filePath)
    const destPath = path.join(targetDir, fileName)

    // Handle name conflicts
    let finalDest = destPath
    let counter = 1
    while (fs.existsSync(finalDest)) {
      const ext = path.extname(fileName)
      const base = path.basename(fileName, ext)
      finalDest = path.join(targetDir, `${base}_(${counter})${ext}`)
      counter++
    }

    fs.renameSync(filePath, finalDest)
    return {
      success: true,
      message: `Moved to: ${finalDest}`
    }
  } catch (err) {
    return { success: false, message: `Failed to move: ${err.message}` }
  }
}

// Cleaning IPC Handlers

/**
 * Get standard folders and their contents for cleaning
 */
ipcMain.handle('cleaner:getStandardFolders', async () => {
  const folders = getStandardFolders()
  return folders.map(f => ({
    ...f,
    exists: fs.existsSync(f.path),
    items: fs.existsSync(f.path) ? scanFolderForCleaning(f.path) : []
  }))
})

/**
 * Scan a specific folder and return non-shortcut items for cleaning
 */
ipcMain.handle('cleaner:scanFolder', async (event, folderPath) => {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder does not exist: ${folderPath}`)
  }
  return scanFolderForCleaning(folderPath)
})

/**
 * Move items to trash
 * items is an array of file paths
 */
ipcMain.handle('cleaner:moveToTrash', async (event, items) => {
  const results = []
  for (const itemPath of items) {
    results.push(await moveToTrash(itemPath))
  }
  return results
})

/**
 * Permanently delete items
 * items is an array of file paths
 */
ipcMain.handle('cleaner:permanentDelete', async (event, items) => {
  const results = []
  for (const itemPath of items) {
    results.push(permanentDelete(itemPath))
  }
  return results
})

/**
 * Move items to a target directory
 * items is an array of file paths, targetDir is the destination
 */
ipcMain.handle('cleaner:moveToFolder', async (event, items, targetDir) => {
  const results = []
  for (const itemPath of items) {
    results.push(moveToFolder(itemPath, targetDir))
  }
  return results
})

/**
 * Open a folder selection dialog for choosing a destination folder
 */
ipcMain.handle('cleaner:selectDestinationFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select destination folder for moved items'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

/**
 * Find and return duplicate shortcuts on the Desktop
 */
ipcMain.handle('cleaner:findDuplicateShortcuts', async () => {
  const desktop = path.join(os.homedir(), 'Desktop')
  if (!fs.existsSync(desktop)) {
    return []
  }
  return findDuplicateShortcuts(desktop)
})

/**
 * Check if the Recycle Bin has any items
 * Uses Shell.Application COM object to count items
 */
async function isRecycleBinEmpty() {
  const { execSync } = require('child_process')

  try {
    // Use PowerShell to count items in the Recycle Bin
    const output = execSync(
      'powershell -NoProfile -Command "& {(New-Object -ComObject Shell.Application).NameSpace(0x0a).Items().Count}"',
      { timeout: 10000, windowsHide: true, encoding: 'utf-8' }
    )
    const count = parseInt(output.trim(), 10)
    return { success: true, isEmpty: count === 0, count: count || 0 }
  } catch (err) {
    // Fallback VBScript approach
    try {
      const tmpFile = path.join(os.tmpdir(), `check_recycle_bin_${Date.now()}.vbs`)
      const vbsContent = `
Set objShell = CreateObject("Shell.Application")
Set objFolder = objShell.NameSpace(&H0a&)
WScript.Echo objFolder.Items().Count
`.trim()
      fs.writeFileSync(tmpFile, vbsContent)
      const output = execSync(`cscript //NoLogo "${tmpFile}"`, {
        timeout: 10000,
        windowsHide: true,
        encoding: 'utf-8'
      })
      const count = parseInt(output.trim(), 10)
      return { success: true, isEmpty: count === 0, count: count || 0 }
    } catch (err2) {
      return { success: false, isEmpty: false, count: 0, error: err2.message }
    } finally {
      try { if (tmpFile) fs.unlinkSync(tmpFile) } catch (e) { /* ignore */ }
    }
  }
}

/**
 * Empty the entire Windows Recycle Bin
 * Uses Shell.Application COM object via PowerShell which is the most reliable method
 */
async function emptyRecycleBin() {
  const { execSync } = require('child_process')

  // Generate a unique VBScript file to run the operation silently
  const tmpFile = path.join(os.tmpdir(), `empty_recycle_bin_${Date.now()}.vbs`)
  const vbsContent = `
Set objShell = CreateObject("Shell.Application")
Set objFolder = objShell.NameSpace(&H0a&)
objFolder.Items().InvokeVerbEx("delete")
`.trim()

  try {
    fs.writeFileSync(tmpFile, vbsContent)

    // Run the VBScript silently using CScript
    execSync(`cscript //NoLogo "${tmpFile}"`, {
      timeout: 30000,
      windowsHide: true
    })

    return { success: true, message: 'Recycle Bin emptied successfully' }
  } catch (err) {
    // Fallback: try direct PowerShell COM approach with confirmation suppression
    try {
      execSync(
        'powershell -NoProfile -Command "$shell = New-Object -ComObject Shell.Application; $shell.NameSpace(0x0a).Items() | %%{ $_.InvokeVerbEx(\'delete\') }"',
        { timeout: 30000, windowsHide: true }
      )
      return { success: true, message: 'Recycle Bin emptied successfully' }
    } catch (err2) {
      return { success: false, message: `Failed to empty Recycle Bin: ${err2.message}` }
    }
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpFile) } catch (e) { /* ignore */ }
  }
}

/**
 * Check if Recycle Bin is empty
 */
ipcMain.handle('cleaner:isRecycleBinEmpty', async () => {
  return await isRecycleBinEmpty()
})

/**
 * Empty the Recycle Bin
 */
ipcMain.handle('cleaner:emptyRecycleBin', async () => {
  return await emptyRecycleBin()
})

/**
 * Delete specific duplicate shortcuts
 */
ipcMain.handle('cleaner:deleteShortcuts', async (event, shortcutPaths) => {
  const results = []
  for (const scPath of shortcutPaths) {
    try {
      fs.unlinkSync(scPath)
      results.push({
        success: true,
        message: `Deleted shortcut: ${path.basename(scPath)}`
      })
    } catch (err) {
      results.push({
        success: false,
        message: `Failed to delete shortcut: ${err.message}`
      })
    }
  }
  return results
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