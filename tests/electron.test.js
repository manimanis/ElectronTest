// tests/electron.test.js
// Unit tests for functions in electron/utils.js

import { describe, it, expect } from 'vitest'
import {
  formatSize,
  buildResolvedPath,
  isShortcut,
  serializeForIpc,
  buildArchiveName,
  getDefaultConfig,
  resolveSevenZipPath,
  sortChildren,
  calculateStats
} from '../electron/utils.js'

// ---------------------------------------------------------------------------
// Tests for formatSize
// ---------------------------------------------------------------------------
describe('formatSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B')
  })

  it('formats bytes without unit changes', () => {
    expect(formatSize(1)).toBe('1 B')
    expect(formatSize(500)).toBe('500 B')
    expect(formatSize(1023)).toBe('1023 B')
  })

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1 KB')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatSize(1048576)).toBe('1 MB')
    expect(formatSize(5242880)).toBe('5 MB')
    expect(formatSize(1572864)).toBe('1.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatSize(1073741824)).toBe('1 GB')
    expect(formatSize(2684354560)).toBe('2.5 GB')
  })

  it('formats terabytes', () => {
    expect(formatSize(1099511627776)).toBe('1 TB')
    expect(formatSize(5497558138880)).toBe('5 TB')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatSize(1260)).toBe('1.23 KB')
    expect(formatSize(1193046476.8)).toBe('1.11 GB')
  })

  it('handles negative values without throwing', () => {
    expect(() => formatSize(-1)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Tests for buildResolvedPath
// ---------------------------------------------------------------------------
describe('buildResolvedPath', () => {
  it('returns basePath when no suffix provided', () => {
    expect(buildResolvedPath('/base', null)).toBe('/base')
    expect(buildResolvedPath('/base', undefined)).toBe('/base')
    expect(buildResolvedPath('/base', '')).toBe('/base')
  })

  it('removes leading forward slash from suffix', () => {
    const result = buildResolvedPath('/base', '/subdir')
    expect(result).toContain('base')
    expect(result).toContain('subdir')
  })

  it('removes leading backslash from suffix', () => {
    const result = buildResolvedPath('C:\\base', '\\subdir')
    expect(result).toContain('base')
    expect(result).toContain('subdir')
  })

  it('joins paths normally when no leading separators', () => {
    const result = buildResolvedPath('/base', 'subdir')
    expect(result).toContain('base')
    expect(result).toContain('subdir')
  })

  it('handles nested paths', () => {
    const result = buildResolvedPath('/base', 'dir1/dir2/file.txt')
    expect(result).toContain('base')
    expect(result).toContain('dir1')
    expect(result).toContain('dir2')
    expect(result).toContain('file.txt')
  })

  it('handles Windows-style paths', () => {
    const result = buildResolvedPath('C:\\Users', 'Desktop')
    expect(result).toContain('Users')
    expect(result).toContain('Desktop')
  })
})

// ---------------------------------------------------------------------------
// Tests for isShortcut
// ---------------------------------------------------------------------------
describe('isShortcut', () => {
  it('returns true for .lnk extension', () => {
    expect(isShortcut('file.lnk')).toBe(true)
  })

  it('returns true for .lnk in full path', () => {
    expect(isShortcut('C:\\Users\\Desktop\\shortcut.lnk')).toBe(true)
    expect(isShortcut('/path/to/file.lnk')).toBe(true)
  })

  it('returns true for uppercase .LNK extension', () => {
    expect(isShortcut('file.LNK')).toBe(true)
    expect(isShortcut('file.Lnk')).toBe(true)
  })

  it('returns false for non-.lnk files', () => {
    expect(isShortcut('file.txt')).toBe(false)
    expect(isShortcut('file.exe')).toBe(false)
    expect(isShortcut('file.lnkx')).toBe(false)
  })

  it('returns false for file without extension', () => {
    expect(isShortcut('file')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isShortcut('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests for serializeForIpc
// ---------------------------------------------------------------------------
describe('serializeForIpc', () => {
  it('serializes a simple object', () => {
    expect(serializeForIpc({ name: 'test', value: 42 })).toEqual({ name: 'test', value: 42 })
  })

  it('serializes an array', () => {
    expect(serializeForIpc([1, 2, { a: 'b' }])).toEqual([1, 2, { a: 'b' }])
  })

  it('serializes strings', () => {
    expect(serializeForIpc('hello')).toBe('hello')
  })

  it('serializes numbers', () => {
    expect(serializeForIpc(42)).toBe(42)
    expect(serializeForIpc(0)).toBe(0)
    expect(serializeForIpc(-5)).toBe(-5)
  })

  it('serializes booleans', () => {
    expect(serializeForIpc(true)).toBe(true)
    expect(serializeForIpc(false)).toBe(false)
  })

  it('serializes null', () => {
    expect(serializeForIpc(null)).toBe(null)
  })

  it('returns null for circular references', () => {
    const circular = {}
    circular.self = circular
    expect(serializeForIpc(circular)).toBe(null)
  })

  it('handles deeply nested objects', () => {
    const obj = { a: { b: { c: { d: [1, 2, 3] } } } }
    expect(serializeForIpc(obj)).toEqual(obj)
  })

  it('strips undefined values', () => {
    expect(serializeForIpc({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null })
  })

  it('creates a deep copy, not a reference', () => {
    const original = { nested: { value: 1 } }
    const serialized = serializeForIpc(original)
    original.nested.value = 999
    expect(serialized.nested.value).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Tests for buildArchiveName
// ---------------------------------------------------------------------------
describe('buildArchiveName', () => {
  it('uses parent folder name of first item', () => {
    const result = buildArchiveName(['C:\\Users\\Test\\Desktop\\file.txt'])
    expect(result).toMatch(/^Desktop_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.7z$/)
  })

  it('falls back to "archive" when items array is empty', () => {
    const result = buildArchiveName([])
    expect(result).toMatch(/^archive_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.7z$/)
  })

  it('produces ISO-like date format without colons', () => {
    const result = buildArchiveName(['/home/user/Documents/report.pdf'])
    expect(result).toMatch(/^Documents_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.7z$/)
  })

  it('extracts parent folder from nested paths', () => {
    const result = buildArchiveName(['/a/b/c/d/file.txt'])
    expect(result).toMatch(/^d_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.7z$/)
  })

  it('uses first item parent for multiple items', () => {
    const result = buildArchiveName(['/first/folder/file.txt', '/second/other/file2.txt'])
    expect(result).toMatch(/^folder_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.7z$/)
  })

  it('always ends with .7z extension', () => {
    const result = buildArchiveName(['/test/item.txt'])
    expect(result.endsWith('.7z')).toBe(true)
  })

  it('contains a valid date/time in the filename', () => {
    const result = buildArchiveName(['/dir/file.txt'])
    const match = result.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.7z$/)
    expect(match).not.toBeNull()
    const dateStr = match[1]
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)
  })
})

// ---------------------------------------------------------------------------
// Tests for getDefaultConfig
// ---------------------------------------------------------------------------
describe('getDefaultConfig', () => {
  it('returns default folders pointing to user home directory', () => {
    const config = getDefaultConfig('C:\\Users\\TestUser')
    expect(config.folders).toHaveLength(3)
    expect(config.folders[0].name).toBe('Desktop')
    expect(config.folders[0].path).toContain('TestUser')
    expect(config.folders[0].path).toContain('Desktop')
    expect(config.folders[1].name).toBe('Documents')
    expect(config.folders[2].name).toBe('Downloads')
  })

  it('all folders have isRegex false and enabled true', () => {
    const config = getDefaultConfig('/home/test')
    for (const folder of config.folders) {
      expect(folder.isRegex).toBe(false)
      expect(folder.enabled).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests for resolveSevenZipPath (path replacement logic)
// ---------------------------------------------------------------------------
describe('resolveSevenZipPath (app.asar replacement)', () => {
  it('replaces app.asar with app.asar.unpacked in the path', () => {
    expect(resolveSevenZipPath('/app/app.asar/resources/7za.exe')).toBe(
      '/app/app.asar.unpacked/resources/7za.exe'
    )
  })

  it('does nothing if app.asar is not in the path', () => {
    expect(resolveSevenZipPath('/usr/local/bin/7za')).toBe('/usr/local/bin/7za')
  })

  it('replaces only the first occurrence', () => {
    expect(resolveSevenZipPath('/app.asar/app.asar/resources/7za.exe')).toBe(
      '/app.asar.unpacked/app.asar/resources/7za.exe'
    )
  })

  it('handles the real-world path format', () => {
    expect(resolveSevenZipPath(
      'C:\\app\\app.asar\\node_modules\\7zip-bin\\7za.exe'
    )).toBe(
      'C:\\app\\app.asar.unpacked\\node_modules\\7zip-bin\\7za.exe'
    )
  })
})

// ---------------------------------------------------------------------------
// Tests for scanDirectory children sorting
// ---------------------------------------------------------------------------
describe('scanDirectory children sorting', () => {
  it('sorts folders before files', () => {
    const children = [
      { name: 'file.txt', type: 'file' },
      { name: 'folder', type: 'folder' },
      { name: 'a_file.txt', type: 'file' }
    ]
    const sorted = sortChildren(children)
    expect(sorted[0].type).toBe('folder')
    expect(sorted[1].type).toBe('file')
    expect(sorted[2].type).toBe('file')
  })

  it('sorts alphabetically within same type', () => {
    const children = [
      { name: 'zebra.txt', type: 'file' },
      { name: 'apple.txt', type: 'file' },
      { name: 'banana.txt', type: 'file' }
    ]
    const sorted = sortChildren(children)
    expect(sorted[0].name).toBe('apple.txt')
    expect(sorted[1].name).toBe('banana.txt')
    expect(sorted[2].name).toBe('zebra.txt')
  })

  it('sorts folders first then alphabetically', () => {
    const children = [
      { name: 'ZFolder', type: 'folder' },
      { name: 'apple.txt', type: 'file' },
      { name: 'AFolder', type: 'folder' }
    ]
    const sorted = sortChildren(children)
    expect(sorted[0].name).toBe('AFolder')
    expect(sorted[1].name).toBe('ZFolder')
    expect(sorted[2].name).toBe('apple.txt')
  })

  it('does not mutate original array', () => {
    const children = [
      { name: 'b.txt', type: 'file' },
      { name: 'a.txt', type: 'file' }
    ]
    sortChildren(children)
    expect(children[0].name).toBe('b.txt')
    expect(children[1].name).toBe('a.txt')
  })

  it('handles empty array', () => {
    expect(sortChildren([])).toEqual([])
  })

  it('handles single element', () => {
    const children = [{ name: 'only.txt', type: 'file' }]
    expect(sortChildren(children)).toEqual([{ name: 'only.txt', type: 'file' }])
  })
})

// ---------------------------------------------------------------------------
// Tests for calculateStats (analyzeFolder helper)
// ---------------------------------------------------------------------------
describe('calculateStats (analyzeFolder helper)', () => {
  it('counts a single file', () => {
    const node = { type: 'file', size: 100, children: [] }
    expect(calculateStats(node)).toEqual({ totalFiles: 1, totalFolders: 0, totalSize: 100 })
  })

  it('counts a single folder', () => {
    const node = { type: 'folder', children: [] }
    expect(calculateStats(node)).toEqual({ totalFiles: 0, totalFolders: 1, totalSize: 0 })
  })

  it('counts folder with files', () => {
    const node = {
      type: 'folder',
      children: [
        { type: 'file', size: 200, children: [] },
        { type: 'file', size: 300, children: [] },
        {
          type: 'folder', children: [
            { type: 'file', size: 500, children: [] }
          ]
        }
      ]
    }
    expect(calculateStats(node)).toEqual({ totalFiles: 3, totalFolders: 2, totalSize: 1000 })
  })

  it('handles empty folder', () => {
    const node = { type: 'folder', children: [] }
    expect(calculateStats(node)).toEqual({ totalFiles: 0, totalFolders: 1, totalSize: 0 })
  })

  it('handles deeply nested structure', () => {
    const node = {
      type: 'folder',
      children: [
        {
          type: 'folder', children: [
            {
              type: 'folder', children: [
                { type: 'file', size: 100, children: [] }
              ]
            }
          ]
        },
        { type: 'file', size: 50, children: [] }
      ]
    }
    expect(calculateStats(node)).toEqual({ totalFiles: 2, totalFolders: 3, totalSize: 150 })
  })

  it('calculates size correctly with mixed files', () => {
    const node = {
      type: 'folder',
      children: [
        { type: 'file', size: 1024, children: [] },
        { type: 'file', size: 2048, children: [] },
        {
          type: 'folder', children: [
            { type: 'file', size: 4096, children: [] }
          ]
        }
      ]
    }
    const stats = calculateStats(node)
    expect(stats.totalSize).toBe(7168)
    expect(stats.totalFiles).toBe(3)
    expect(stats.totalFolders).toBe(2)
  })

  it('handles files with zero size', () => {
    const node = {
      type: 'folder',
      children: [
        { type: 'file', size: 0, children: [] },
        { type: 'file', size: 0, children: [] }
      ]
    }
    const stats = calculateStats(node)
    expect(stats.totalSize).toBe(0)
    expect(stats.totalFiles).toBe(2)
  })
})