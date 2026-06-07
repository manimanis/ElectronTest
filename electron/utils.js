// electron/utils.js
// Pure utility functions extracted from main.js for testability
// These functions do NOT depend on Electron APIs

import path from 'path'

/**
 * Format file size to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g. "1.5 GB")
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

/**
 * Build a resolved path from a base path and a suffix string.
 * Uses path.join instead of string concatenation for proper path handling.
 */
export function buildResolvedPath(basePath, suffix) {
  if (!suffix) return basePath
  // Remove leading slashes/backslashes from suffix for path.join
  const cleanSuffix = suffix.replace(/^[/\\]+/, '')
  if (!cleanSuffix) return basePath
  return path.join(basePath, cleanSuffix)
}

/**
 * Check if a file is a shortcut (.lnk on Windows)
 */
export function isShortcut(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.lnk'
}

/**
 * Check if a file is a shortcut by its symlink attribute or .lnk extension
 */
export function isShortcutOrSymlink(filePath) {
  // .lnk files are Windows shortcuts
  if (isShortcut(filePath)) return true
  try {
    const stats = require('fs').lstatSync(filePath)
    return stats.isSymbolicLink()
  } catch (e) {
    return false
  }
}

/**
 * Helper: safely serialize data for IPC (prevents "An object could not be cloned" errors)
 */
export function serializeForIpc(data) {
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (err) {
    console.error('IPC serialization error:', err.message)
    return null
  }
}

/**
 * Build an archive filename from the parent folder of the first item + current date/time ISO
 * Example: if item is C:\Users\Me\Desktop\file.txt → Desktop_2026-06-06T08-30-00.7z
 */
export function buildArchiveName(items) {
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
 * Default folder configuration
 * @param {string} homeDir - User home directory
 */
export function getDefaultConfig(homeDir) {
  return {
    folders: [
      { name: 'Desktop', path: path.join(homeDir, 'Desktop'), isRegex: false, enabled: true },
      { name: 'Documents', path: path.join(homeDir, 'Documents'), isRegex: false, enabled: true },
      { name: 'Downloads', path: path.join(homeDir, 'Downloads'), isRegex: false, enabled: true }
    ]
  }
}

/**
 * Get 7zip binary path with app.asar.unpacked replacement
 * @param {string} originalPath - Original path from 7zip-bin
 */
export function resolveSevenZipPath(originalPath) {
  return originalPath.replace('app.asar', 'app.asar.unpacked')
}

/**
 * Sort scanDirectory children: folders first, then alphabetically
 */
export function sortChildren(children) {
  return [...children].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Recursively calculate stats (files, folders, size) from a tree node
 * @param {{ type: string, size: number, children: Array }} node
 * @returns {{ totalFiles: number, totalFolders: number, totalSize: number }}
 */
export function calculateStats(node) {
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

/**
 * Resolve path entry which can be a wildcard pattern or a full path.
 * This is a partial extraction — the main logic stays in main.js
 * because it depends on fs and getDriveRoots which are Electron-specific.
 */