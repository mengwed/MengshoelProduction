import { describe, it, expect } from 'vitest'
import { sanitize, sanitizeObject } from './sanitize'

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('preserves normal text', () => {
    expect(sanitize('Faktura 12345')).toBe('Faktura 12345')
  })

  it('strips nested tags', () => {
    expect(sanitize('<div><b>bold</b></div>')).toBe('bold')
  })

  it('handles null/undefined', () => {
    expect(sanitize(null)).toBe(null)
    expect(sanitize(undefined)).toBe(undefined)
  })
})

describe('sanitizeObject', () => {
  it('sanitizes all string values in object', () => {
    const result = sanitizeObject({
      name: '<b>Test</b>',
      amount: 100,
      note: '<script>x</script>',
    })
    expect(result).toEqual({
      name: 'Test',
      amount: 100,
      note: 'x',
    })
  })

  it('handles nested objects', () => {
    const result = sanitizeObject({
      counterpart_name: '<img onerror=alert(1)>Safe Name',
    })
    expect(result.counterpart_name).toBe('Safe Name')
  })
})
