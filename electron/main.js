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
 * Format file size to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g. "1.5 GB")
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

/**
 * Configuration file path (stored in user data directory)
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'folder-config.json')
}

/**
 * Default folder configuration
 */
function getDefaultConfig() {
  const homeDir = os.homedir()
  return {
    folders: [
      { name: 'Desktop', path: path.join(homeDir, 'Desktop'), isRegex: false, enabled: true },
      { name: 'Documents', path: path.join(homeDir, 'Documents'), isRegex: false, enabled: true },
      { name: 'Downloads', path: path.join(homeDir, 'Downloads'), isRegex: false, enabled: true }
    ]
  }
}

/**
 * Load folder configuration from disk
 */
function loadConfig() {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Failed to load config:', err.message)
  }
  return getDefaultConfig()
}

/**
 * Save folder configuration to disk
 */
function saveConfig(config) {
  try {
    const configPath = getConfigPath()
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to save config:', err.message)
    return false
  }
}

/**
 * Build a resolved path from a base path and a suffix string.
 * Uses path.join instead of string concatenation for proper path handling.
 */
function buildResolvedPath(basePath, suffix) {
  if (!suffix) return basePath
  // Remove leading slashes/backslashes from suffix for path.join
  const cleanSuffix = suffix.replace(/^[/\\]+/, '')
  if (!cleanSuffix) return basePath
  return path.join(basePath, cleanSuffix)
}

/**
 * Resolve a path entry which can be a wildcard pattern or a full path.
 * Supports:
 *   - Full paths: "C:\Users\Alice\Desktop"
 *   - Single wildcard: "C:\Users\*\Desktop" (wildcard for one directory level)
 *   - Drive wildcard: "*:\Bac*" (wildcard for drive letter + folder name starts with Bac)
 *   - Nested wildcards: "C:\Users\*\Desktop\*"
 * Returns an array of resolved absolute paths.
 */
function resolvePathEntry(entry) {
  if (!entry.isRegex) {
    // Full path: verify it exists and is a directory
    try {
      if (fs.existsSync(entry.path)) {
        if (fs.statSync(entry.path).isDirectory()) {
          return [path.normalize(entry.path)]
        }
        console.log('config: path is not a directory:', entry.path)
        return []
      }
      console.log('config: path does not exist:', entry.path)
      return []
    } catch (err) {
      console.error('Failed to check path:', entry.path, err.message)
      return []
    }
  }

  const pattern = entry.path
  if (!pattern || !pattern.includes('*')) {
    // No wildcard, treat as full path
    try {
      if (fs.existsSync(pattern)) {
        return [path.normalize(pattern)]
      }
      return []
    } catch (err) {
      return []
    }
  }

  console.log('config: resolving pattern:', pattern)
  try {
    // Handle all wildcard patterns with the generic recursive resolver
    const results = resolvePathPatternInternal(pattern)
    console.log('config: resolved to:', JSON.stringify(results))
    return results
  } catch (err) {
    console.error('Failed to resolve path entry:', entry.path, err.message)
    return []
  }
}

/**
 * Internal recursive path pattern resolver.
 * Supports:
 *   - "*:\..." wildcard drive letter
 *   - "*\" wildcard at start
 *   - "..." wildcard in middle/end
 */
function resolvePathPatternInternal(pattern) {
  // Normalize backslashes for consistent processing
  const normPattern = pattern.replace(/\//g, '\\')

  const starIndex = normPattern.indexOf('*')
  if (starIndex === -1) {
    // No more wildcards — just check existence
    try {
      if (fs.existsSync(normPattern)) {
        return [path.normalize(normPattern)]
      }
    } catch (_) {}
    return []
  }

  // Handle "*:\..." — wildcard drive letter
  if (normPattern.startsWith('*:\\') || normPattern.startsWith('*:')) {
    const suffixPattern = normPattern.substring(2) // everything after "*:"
    const drives = getDriveRoots()
    const results = []
    for (const drive of drives) {
      const driveLetter = drive.replace(/\\/g, '')
      const fullCandidate = driveLetter + suffixPattern
      if (fullCandidate.includes('*')) {
        const subResults = resolvePathPatternInternal(fullCandidate)
        results.push(...subResults)
      } else if (!suffixPattern.includes('*')) {
        try {
          if (fs.existsSync(fullCandidate)) {
            results.push(path.normalize(fullCandidate))
          }
        } catch (_) { /* skip */ }
      }
    }
    return results
  }

  // Handle "*\" at start (wildcard after drive is already handled above)
  if (normPattern.startsWith('*\\')) {
    // Enumerate all drives as starting points
    const drives = getDriveRoots()
    const suffix = normPattern.substring(2) // everything after "*\"
    const results = []
    for (const drive of drives) {
      try {
        const entries = fs.readdirSync(drive)
        for (const entry of entries) {
          const fullPath = path.join(drive, entry)
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              const candidate = path.join(fullPath, suffix)
              if (candidate.includes('*')) {
                const subResults = resolvePathPatternInternal(candidate)
                results.push(...subResults)
              } else {
                try {
                  if (fs.existsSync(candidate)) {
                    results.push(path.normalize(candidate))
                  }
                } catch (_) { /* skip */ }
              }
            }
          } catch (_) { /* skip inaccessible */ }
        }
      } catch (_) { /* skip inaccessible drives */ }
    }
    return results
  }

  // General case: split on first *, expand the wildcard level
  const prefix = normPattern.substring(0, starIndex)
  const suffix = normPattern.substring(starIndex + 1)

  // Determine if this is a "prefix match" (wildcard within a path segment, e.g. "Bac*")
  // vs a "directory level" wildcard (e.g. "Users\*\Desktop")
  const hasPathSepInSuffix = suffix.includes('\\') || suffix.includes('/')

  if (!hasPathSepInSuffix) {
    // Case: wildcard matches a prefix within a single path segment.
    // Example: "*:\Bac*" → drive "C:", prefix "Bac" → find all entries starting with "Bac"
    // Example: "C:\Users\Bac*" → find entries in C:\Users starting with "Bac"
    // Get the parent directory and the prefix to match
    const parentDir = path.dirname(prefix)
    const namePrefix = path.basename(prefix) + suffix

    try {
      if (!fs.existsSync(parentDir)) {
        console.log('config: parent dir does not exist:', parentDir)
        return []
      }

      const entries = fs.readdirSync(parentDir)
      const results = []
      for (const entry of entries) {
        // Match entries that start with the namePrefix
        if (entry.toLowerCase().startsWith(namePrefix.toLowerCase())) {
          const fullPath = path.join(parentDir, entry)
          try {
            if (fs.existsSync(fullPath)) {
              results.push(path.normalize(fullPath))
            }
          } catch (_) { /* skip */ }
        }
      }
      return results
    } catch (_) {
      return []
    }
  }

  // Case: wildcard replaces a full directory level.
  // Example: "C:\Users\*\Desktop" → for each subdir of C:\Users, check if Desktop exists

  // Verify prefix exists
  try {
    if (!fs.existsSync(prefix)) {
      console.log('config: prefix does not exist:', prefix)
      return []
    }
  } catch (_) {
    return []
  }

  const results = []

  // Get entries at the wildcard level
  let entries
  try {
    entries = fs.readdirSync(prefix)
  } catch (_) {
    return []
  }

  for (const entry of entries) {
    const fullPath = path.join(prefix, entry)
    try {
      // Only directories can have sub-paths
      if (fs.statSync(fullPath).isDirectory()) {
        const candidate = buildResolvedPath(fullPath, suffix)
        if (candidate.includes('*')) {
          const subResults = resolvePathPatternInternal(candidate)
          results.push(...subResults)
        } else {
          try {
            if (fs.existsSync(candidate)) {
              results.push(path.normalize(candidate))
            }
          } catch (_) { /* skip */ }
        }
      }
    } catch (_) { /* skip inaccessible */ }
  }

  return results
}

/**
 * Get the list of folders to display based on configuration.
 * Resolves regex patterns and filters enabled folders.
 * Only directories are included — individual files are excluded from the folder list.
 */
function getConfiguredFolders() {
  const config = loadConfig()
  const resolvedFolders = []

  for (const entry of config.folders) {
    if (!entry.enabled) continue

    const resolvedPaths = resolvePathEntry(entry)

    // resolvedPaths is always an array
    for (const p of resolvedPaths) {
      // Skip if already added
      if (resolvedFolders.some(f => f.path === p)) continue
      // Only include directories, not individual files
      try {
        if (fs.statSync(p).isDirectory()) {
          resolvedFolders.push({ name: path.basename(p), path: p })
        }
      } catch (_) {
        // Skip inaccessible paths
      }
    }
  }

  return resolvedFolders
}

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
 * Get a list of logical drive root paths on Windows (e.g. C:\, D:\, etc.)
 */
function getDriveRoots() {
  const drives = []
  try {
    const { execSync } = require('child_process')
    const output = execSync('wmic logicaldisk get name', {
      timeout: 5000,
      windowsHide: true,
      encoding: 'utf-8'
    })
    const lines = output.split('\n').map(l => l.trim()).filter(l => l && l !== 'Name')
    for (const line of lines) {
      const driveRoot = line.replace(/\\/g, '') + '\\'
      if (fs.existsSync(driveRoot)) {
        drives.push(driveRoot)
      }
    }
  } catch (e) {
    // Fallback: try common drive letters
    for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')) {
      const driveRoot = letter + ':\\'
      try {
        if (fs.existsSync(driveRoot)) {
          drives.push(driveRoot)
        }
      } catch (_) { /* skip inaccessible drives */ }
    }
  }
  return drives
}

/**
 * Find folders at the root of drives whose name matches "Bac" followed by digits (e.g. Bac2026, Bac2025)
 */
function findBacFolders() {
  const bacFolders = []
  const bacPattern = /^Bac\d+$/i
  const drives = getDriveRoots()

  for (const driveRoot of drives) {
    try {
      const entries = fs.readdirSync(driveRoot)
      for (const entry of entries) {
        const fullPath = path.join(driveRoot, entry)
        try {
          if (fs.statSync(fullPath).isDirectory() && bacPattern.test(entry)) {
            bacFolders.push({ name: entry, path: fullPath })
          }
        } catch (_) { /* skip inaccessible */ }
      }
    } catch (_) { /* skip inaccessible drives */ }
  }

  return bacFolders
}

/**
 * Get the list of standard user folders to clean
 * Includes: Desktop, Documents, Downloads, and any Bac### folders found on drive roots
 */
function getStandardFolders() {
  const homeDir = os.homedir()
  const desktop = path.join(homeDir, 'Desktop')
  const documents = path.join(homeDir, 'Documents')
  const downloads = path.join(homeDir, 'Downloads')

  const folders = [
    { name: 'Desktop', path: desktop },
    { name: 'Documents', path: documents },
    { name: 'Downloads', path: downloads }
  ]

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
 * Calculate total size of a directory recursively
 */
function getDirectorySize(dirPath) {
  let totalSize = 0
  try {
    const entries = fs.readdirSync(dirPath)
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry)
      try {
        const stats = fs.statSync(fullPath)
        if (stats.isDirectory()) {
          totalSize += getDirectorySize(fullPath)
        } else {
          totalSize += stats.size
        }
      } catch (e) {
        // Skip inaccessible items
      }
    }
  } catch (e) {
    // Skip inaccessible directories
  }
  return totalSize
}

/**
 * Scan a folder and return subdirectories only (no files).
 * Only directories are included — individual files are excluded from cleaning.
 * Skips shortcuts (.lnk files) from cleaning operations.
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

        const isDir = stats.isDirectory()
        // For directories, compute size recursively; for files, use direct size
        const itemSize = isDir ? getDirectorySize(fullPath) : stats.size
        items.push({
          name: entry,
          path: fullPath,
          size: itemSize,
          formattedSize: formatSize(itemSize),
          modifiedAt: stats.mtime.toISOString(),
          isDirectory: isDir
        })
      } catch (e) {
        // Skip inaccessible items
      }
    }
  } catch (e) {
    console.warn(`Cannot scan ${folderPath}: ${e.message}`)
  }

  // Sort alphabetically
  items.sort((a, b) => a.name.localeCompare(b.name))

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
 * Now uses the configured folders instead of hardcoded ones
 */
ipcMain.handle('cleaner:getStandardFolders', async () => {
  const folders = getConfiguredFolders()
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
 * Build an archive filename from the parent folder of the first item + current date/time ISO
 * Example: if item is C:\Users\Me\Desktop\file.txt → Desktop_2026-06-06T08-30-00.7z
 */
function buildArchiveName(items) {
  // Get the parent folder name of the first item
  let parentName = 'archive'
  if (items.length > 0) {
    const parentDir = path.dirname(items[0])
    parentName = path.basename(parentDir)
  }

  // ISO-like date/time without colons (safe for filenames)
  const now = new Date()
  const pad = (n) => n.toString().padStart(2, '0')
  const dateStr =
    now.getFullYear() + '-' +
    pad(now.getMonth() + 1) + '-' +
    pad(now.getDate()) + 'T' +
    pad(now.getHours()) + '-' +
    pad(now.getMinutes()) + '-' +
    pad(now.getSeconds())

  return `${parentName}_${dateStr}.7z`
}

/**
 * Archive selected items to a 7z file using 7za
 * items: array of file/folder paths to archive
 * destDir: optional destination directory — if provided, saves directly there without dialog;
 *          if omitted, shows a native save dialog
 * Returns: { success, archivePath, error, canceled }
 */
ipcMain.handle('cleaner:archiveTo7z', async (event, items, destDir) => {
  const { execSync } = require('child_process')

  let archivePath

  if (destDir) {
    // Save directly in the given directory with an auto-generated name
    const fileName = buildArchiveName(items)
    archivePath = path.join(destDir, fileName)
    // Avoid overwriting: append (1), (2), etc.
    let counter = 1
    while (fs.existsSync(archivePath)) {
      const ext = path.extname(fileName)
      const base = path.basename(fileName, ext)
      archivePath = path.join(destDir, `${base}_(${counter})${ext}`)
      counter++
    }
  } else {
    // Show save dialog (first time)
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer l\'archive 7z',
      defaultPath: path.join(os.homedir(), 'Downloads', 'archive.7z'),
      filters: [{ name: '7z Archive', extensions: ['7z'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    archivePath = result.filePath
  }

  try {
    const sevenZip = require('7zip-bin')
    let sevenZipPath = sevenZip.path7za

    // Build the argument list: 7za a -y archive.7z "item1" "item2" ...
    const args = ['a', '-y', archivePath, ...items]

    sevenZipPath = sevenZipPath.replace("app.asar", "app.asar.unpacked")

    execSync(`"${sevenZipPath}" ${args.map(a => `"${a}"`).join(' ')}`, {
      timeout: 300000, // 5 minutes max
      windowsHide: true,
      encoding: 'utf-8'
    })

    return { success: true, archivePath }
  } catch (err) {
    console.error('7z archiving failed:', err.message)
    return { success: false, error: err.message }
  }
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

  function powerShellCount() {
    let count = 0, success = false
    try {
      // Use PowerShell to count items in the Recycle Bin
      const output = execSync(
        'powershell -NoProfile -Command "& {(New-Object -ComObject Shell.Application).NameSpace(0x0a).Items().Count}"',
        { timeout: 10000, windowsHide: true, encoding: 'utf-8' }
      )
      count = parseInt(output.trim())
      success = true
    } catch (err) {
      success = false
    }
    return { success, count }
  }

  function vbsCount() {
    let count = 0, success = false, tmpFile = null
    try {
      tmpFile = path.join(os.tmpdir(), `check_recycle_bin_${Date.now()}.vbs`)
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
      count = parseInt(output.trim())
      success = true
    } catch (err) {
      success = false
    } finally {
      try { if (tmpFile) fs.unlinkSync(tmpFile) } catch (e) { /* ignore */ }
    }
    return { success, count }
  }

  let result = powerShellCount()
  if (!result.success) {
    result = vbsCount()
  }
  return result
}

/**
 * Empty the entire Windows Recycle Bin
 * Uses Shell.Application COM object via PowerShell which is the most reliable method
 */
async function emptyRecycleBin() {
  const { execSync } = require('child_process')

  function powerShellEmpty() {
    let success = false, 
      error = ''
    try {
      execSync(
        'powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"',
        { timeout: 30000, windowsHide: true }
      )
      success = true
      error = ''
    } catch (err) {
      success = false
      error = err.message
    }
    return { success, error }
  }

  function vbsEmpty() {
    let tmpFile = null,
      success = false,
      error = ''
    try {
      tmpFile = path.join(os.tmpdir(), `empty_recycle_bin_${Date.now()}.vbs`)
      const vbsContent = `
Set objShell = CreateObject("Shell.Application")
Set objFolder = objShell.NameSpace(&H0a&)
objFolder.Items().InvokeVerbEx("delete")
`.trim()
      fs.writeFileSync(tmpFile, vbsContent)
      execSync(`cscript //NoLogo "${tmpFile}"`, {
        timeout: 30000,
        windowsHide: true
      })
      success = true
      error = ''
    } catch (err) {
      error = err.message
    } finally {
      try { if (tmpFile) fs.unlinkSync(tmpFile) } catch (e) { /* ignore */ }
    }
    return { success, error }
  }

  let result = powerShellEmpty()
  if (!result.success) {
    result = vbsEmpty()
  }
  return result
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

// ============== Configuration IPC Handlers ==============

/**
 * Helper: safely serialize data for IPC (prevents "An object could not be cloned" errors)
 */
function serializeForIpc(data) {
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (err) {
    console.error('IPC serialization error:', err.message)
    return null
  }
}

/**
 * Load folder configuration
 */
ipcMain.handle('config:load', async () => {
  try {
    const config = loadConfig()
    return serializeForIpc(config)
  } catch (err) {
    console.error('config:load error:', err.message)
    return serializeForIpc({ folders: [] })
  }
})

/**
 * Save folder configuration
 */
ipcMain.handle('config:save', async (event, config) => {
  try {
    // Sanitize config before saving
    const safeConfig = serializeForIpc(config)
    if (!safeConfig || !safeConfig.folders) {
      console.error('config:save - invalid config received')
      return false
    }
    return saveConfig(safeConfig)
  } catch (err) {
    console.error('config:save error:', err.message)
    return false
  }
})

/**
 * Get the default configuration
 */
ipcMain.handle('config:getDefaults', async () => {
  try {
    return serializeForIpc(getDefaultConfig())
  } catch (err) {
    console.error('config:getDefaults error:', err.message)
    return serializeForIpc({ folders: [] })
  }
})

/**
 * Validate a folder path or regex pattern
 * Returns { valid, resolved, error }
 * resolved is always an array of paths (or empty array)
 */
/**
 * Find duplicate files across configured folders.
 * Groups files by name (case-insensitive). Files with the same name in different locations are duplicates.
 */
function findDuplicateFiles() {
  const folders = getConfiguredFolders()
  const filesByName = {} // name.toLowerCase() → [{ name, path, size, formattedSize, folder, modifiedAt }]

  for (const folder of folders) {
    if (!fs.existsSync(folder.path)) continue
    try {
      const entries = fs.readdirSync(folder.path)
      for (const entry of entries) {
        const fullPath = path.join(folder.path, entry)
        try {
          const stats = fs.statSync(fullPath)
          if (stats.isDirectory()) continue
          if (isShortcutOrSymlink(fullPath)) continue

          const key = entry.toLowerCase()
          if (!filesByName[key]) filesByName[key] = []
          filesByName[key].push({
            name: entry,
            path: fullPath,
            size: stats.size,
            formattedSize: formatSize(stats.size),
            folder: folder.name,
            modifiedAt: stats.mtime.toISOString()
          })
        } catch (_) { /* skip inaccessible */ }
      }
    } catch (_) { /* skip inaccessible folder */ }
  }

  // Filter: only keep groups with more than 1 file (duplicates)
  const duplicates = []
  for (const [, files] of Object.entries(filesByName)) {
    if (files.length > 1) {
      duplicates.push({ name: files[0].name, files })
    }
  }
  duplicates.sort((a, b) => a.name.localeCompare(b.name))
  return duplicates
}

ipcMain.handle('cleaner:findDuplicateFiles', async () => {
  return findDuplicateFiles()
})

ipcMain.handle('config:validatePath', async (event, entry) => {
  try {
    // Sanitize input
    const safeEntry = serializeForIpc(entry)
    if (!safeEntry || !safeEntry.path) {
      return { valid: false, resolved: [], error: 'Entrée invalide' }
    }
    const resolved = resolvePathEntry(safeEntry)
    if (Array.isArray(resolved) && resolved.length > 0) {
      return serializeForIpc({ valid: true, resolved, error: null })
    }
    return serializeForIpc({ valid: false, resolved: [], error: 'Aucun dossier trouvé avec ce chemin ou motif' })
  } catch (err) {
    console.error('config:validatePath error:', err.message)
    return { valid: false, resolved: [], error: err.message }
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