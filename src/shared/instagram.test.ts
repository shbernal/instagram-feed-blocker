import { describe, expect, it } from 'vitest'
import { isInstagramUrl } from './instagram'

describe('isInstagramUrl', () => {
  it('accepts instagram.com and its subdomains', () => {
    expect(isInstagramUrl('https://www.instagram.com/')).toBe(true)
    expect(isInstagramUrl('https://instagram.com/reels/')).toBe(true)
    expect(isInstagramUrl('https://help.instagram.com/')).toBe(true)
  })

  it('rejects hosts that merely end in the same letters', () => {
    expect(isInstagramUrl('https://notinstagram.com/')).toBe(false)
    expect(isInstagramUrl('https://instagram.com.evil.test/')).toBe(false)
  })

  it('rejects missing or unparseable values', () => {
    expect(isInstagramUrl(undefined)).toBe(false)
    expect(isInstagramUrl('')).toBe(false)
    expect(isInstagramUrl('chrome://extensions')).toBe(false)
    expect(isInstagramUrl('not a url')).toBe(false)
  })
})
