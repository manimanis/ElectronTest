// tests/setup.js
// Vitest setup file — runs before each test suite

// Mock window.electronAPI for component tests
window.electronAPI = {
  onMainLog: () => {},
  selectFolder: () => Promise.resolve(null),
  analyzeFolder: () => Promise.resolve({ tree: {}, stats: { totalFiles: 0, totalFolders: 0, totalSize: 0 } }),
  analyzeFolderAsync: () => Promise.resolve({ tree: {}, stats: { totalFiles: 0, totalFolders: 0, totalSize: 0 } }),
  onScanProgress: () => () => {},
  cancelScan: () => Promise.resolve(true),
  getFileInfo: () => Promise.resolve(null),
  openInSystem: () => Promise.resolve(true),
  openInExplorer: () => Promise.resolve(true),
  getStandardFolders: () => Promise.resolve([]),
  scanFolder: () => Promise.resolve([]),
  moveToTrash: () => Promise.resolve([]),
  permanentDelete: () => Promise.resolve([]),
  moveToFolder: () => Promise.resolve([]),
  selectDestinationFolder: () => Promise.resolve(null),
  findDuplicateShortcuts: () => Promise.resolve([]),
  deleteShortcuts: () => Promise.resolve([]),
  isRecycleBinEmpty: () => Promise.resolve({ success: true, count: 0 }),
  emptyRecycleBin: () => Promise.resolve({ success: true }),
  archiveTo7z: () => Promise.resolve({ success: true, archivePath: '' }),
  loadFolderConfig: () => Promise.resolve({ folders: [] }),
  saveFolderConfig: () => Promise.resolve(true),
  getDefaultFolderConfig: () => Promise.resolve({ folders: [] }),
  validateFolderPath: () => Promise.resolve({ valid: true, resolved: [], error: null })
}