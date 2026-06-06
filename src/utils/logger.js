/**
 * Simple frontend logger for Folder Cleaner
 * Logs are sent to the main process via IPC for persistence
 * Falls back to console if IPC is unavailable
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
let minLevel = LOG_LEVELS.info

function formatTimestamp() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function log(level, category, message, data = null) {
  if (LOG_LEVELS[level] < minLevel) return

  const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}] [${category}]`
  const fullMsg = `${prefix} ${message}`

  // Console output
  switch (level) {
    case 'error': console.error(fullMsg, data || ''); break
    case 'warn': console.warn(fullMsg, data || ''); break
    case 'debug': console.debug(fullMsg, data || ''); break
    default: console.log(fullMsg, data || '')
  }
}

export const logger = {
  setLevel(level) { minLevel = LOG_LEVELS[level] ?? 1 },

  debug(category, msg, data) { log('debug', category, msg, data) },
  info(category, msg, data) { log('info', category, msg, data) },
  warn(category, msg, data) { log('warn', category, msg, data) },
  error(category, msg, data) { log('error', category, msg, data) },

  /** Log an operation (trash, delete, move, archive) */
  operation(type, details) {
    log('info', 'operation', `${type}: ${details.count} élément(s)`, details)
  },

  /** Log a user action */
  action(name, details) {
    log('debug', 'action', name, details)
  }
}

export default logger