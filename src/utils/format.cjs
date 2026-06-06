/**
 * Shared formatting utilities (CommonJS version for Electron main process)
 * Avoids code duplication between frontend views and main process
 */

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

module.exports = { formatSize }