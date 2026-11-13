import { describe, expect, it } from 'vitest'
import { ago, cleanHandle } from './helpers'

describe('cleanHandle', () => {
  it('strips a leading @', () => {
    expect(cleanHandle('@ada')).toBe('ada')
    expect(cleanHandle('@@ada')).toBe('ada')
  })
  it('trims whitespace', () => {
    expect(cleanHandle('  ada  ')).toBe('ada')
  })
  it('returns empty for unusable input', () => {
    expect(cleanHandle('')).toBe('')
    expect(cleanHandle('@')).toBe('')
    expect(cleanHandle('a b')).toBe('')
    expect(cleanHandle('a/b')).toBe('')
    expect(cleanHandle('a'.repeat(65))).toBe('')
  })
  it('accepts valid handles', () => {
    expect(cleanHandle('ada')).toBe('ada')
    expect(cleanHandle('ada.lovelace')).toBe('ada.lovelace')
    expect(cleanHandle('ada_lovelace')).toBe('ada_lovelace')
    expect(cleanHandle('a-1')).toBe('a-1')
  })
})

describe('ago', () => {
  it('returns empty for unparseable input', () => {
    expect(ago('')).toBe('')
    expect(ago('not-a-date')).toBe('')
  })
  it('returns "just now" for under a minute', () => {
    const now = Date.now()
    expect(ago(new Date(now - 30_000).toISOString(), now)).toBe('just now')
  })
  it('returns minutes for under an hour', () => {
    const now = Date.now()
    expect(ago(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m ago')
  })
  it('returns hours for under a day', () => {
    const now = Date.now()
    expect(ago(new Date(now - 3 * 3600_000).toISOString(), now)).toBe('3h ago')
  })
  it('returns days for a day or more', () => {
    const now = Date.now()
    expect(ago(new Date(now - 2 * 86400_000).toISOString(), now)).toBe('2d ago')
  })
  it('clamps future timestamps to "just now"', () => {
    const now = Date.now()
    expect(ago(new Date(now + 60_000).toISOString(), now)).toBe('just now')
  })
})
