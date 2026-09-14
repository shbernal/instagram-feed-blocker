import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  isAllPagesActive,
  isAnyPageActive,
  normalizeSettings,
  PAGE_SECTIONS,
  setAllPages,
  syncActiveWithPages,
  type ExtensionSettings,
} from './settings'

const NOTHING_BLOCKED: ExtensionSettings = {
  active: false,
  overlay: true,
  homeFeed: false,
  homeStories: false,
  homeSuggestions: false,
  explore: false,
  reels: false,
}

describe('DEFAULT_SETTINGS', () => {
  it('blocks every section and shows the overlay', () => {
    PAGE_SECTIONS.forEach(section => {
      expect(DEFAULT_SETTINGS[section]).toBe(true)
    })
    expect(DEFAULT_SETTINGS.overlay).toBe(true)
    expect(DEFAULT_SETTINGS.active).toBe(true)
  })
})

describe('normalizeSettings', () => {
  it('falls back to the defaults for anything that is not an object', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('on')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps stored booleans and fills the rest from the fallback', () => {
    expect(normalizeSettings({ reels: false, overlay: false })).toEqual({
      ...DEFAULT_SETTINGS,
      reels: false,
      overlay: false,
    })
  })

  it('ignores values of the wrong type', () => {
    expect(normalizeSettings({ homeFeed: 'no', explore: 0 })).toEqual(
      DEFAULT_SETTINGS,
    )
  })

  it('reads missing fields from the fallback it is given', () => {
    expect(normalizeSettings({ homeFeed: true }, NOTHING_BLOCKED)).toEqual({
      ...NOTHING_BLOCKED,
      active: true,
      homeFeed: true,
    })
  })

  // A stored `active` that disagrees with the sections is stale by definition.
  it('derives active from the sections rather than trusting storage', () => {
    expect(normalizeSettings({ ...NOTHING_BLOCKED, active: true }).active).toBe(
      false,
    )
    expect(
      normalizeSettings({ ...DEFAULT_SETTINGS, active: false }).active,
    ).toBe(true)
  })

  it('drops fields the contract does not know', () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, feed: false })).toEqual(
      DEFAULT_SETTINGS,
    )
  })
})

describe('section helpers', () => {
  it('reports whether any or every section is blocked', () => {
    const one = { ...NOTHING_BLOCKED, explore: true }

    expect(isAnyPageActive(NOTHING_BLOCKED)).toBe(false)
    expect(isAnyPageActive(one)).toBe(true)
    expect(isAllPagesActive(one)).toBe(false)
    expect(isAllPagesActive(DEFAULT_SETTINGS)).toBe(true)
  })

  // The overlay is not a section, so hiding the card must not read as
  // "something is blocked", and "block everything" must not touch it.
  it('never counts or changes the overlay', () => {
    expect(isAnyPageActive({ ...NOTHING_BLOCKED, overlay: true })).toBe(false)
    expect(setAllPages({ ...NOTHING_BLOCKED, overlay: false }, true)).toEqual({
      ...DEFAULT_SETTINGS,
      overlay: false,
    })
    expect(setAllPages(DEFAULT_SETTINGS, false)).toEqual(NOTHING_BLOCKED)
  })

  it('recomputes active from the sections', () => {
    expect(
      syncActiveWithPages({ ...NOTHING_BLOCKED, active: true }).active,
    ).toBe(false)
    expect(
      syncActiveWithPages({ ...NOTHING_BLOCKED, reels: true }).active,
    ).toBe(true)
  })
})
