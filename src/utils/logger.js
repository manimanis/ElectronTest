/**
 * Simple logger utility
 * In production, could write to a file via IPC
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const currentLevel = LOG_LEVELS.INFO

function log(level, ...args) {
  if (level >= currentLevel) {
    const prefix = Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'LOG'
    console.log(`[${prefix}]`, ...args)
  }
}

export const logger = {
  debug: (...args) => log(LOG_LEVELS.DEBUG, ...args),
  info: (...args) => log(LOG_LEVELS.INFO, ...args),
  warn: (...args) => log(LOG_LEVELS.WARN, ...args),
  error: (...args) => log(LOG_LEVELS.ERROR, ...args)
}