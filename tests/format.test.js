// tests/format.test.js
import { formatSize } from '../src/utils/format'

describe('formatSize', () => {
  it('formats 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B')
  })

  it('formats bytes (< 1 KB)', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(1)).toBe('1 B')
    expect(formatSize(1023)).toBe('1023 B')
  })

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(1048576)).toBe('1 MB')
  })

  it('formats megabytes', () => {
    expect(formatSize(1048576)).toBe('1 MB')
    expect(formatSize(5242880)).toBe('5 MB')
    expect(formatSize(1073741824)).toBe('1 GB')
  })

  it('formats gigabytes', () => {
    expect(formatSize(1073741824)).toBe('1 GB')
    expect(formatSize(2684354560)).toBe('2.5 GB')
    expect(formatSize(1099511627776)).toBe('1 TB')
  })

  it('formats terabytes', () => {
    expect(formatSize(1099511627776)).toBe('1 TB')
    expect(formatSize(5497558138880)).toBe('5 TB')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatSize(1260)).toBe('1.23 KB')
    expect(formatSize(1193046476.8)).toBe('1.11 GB')
  })
})