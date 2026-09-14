import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  PAGE_SECTIONS,
  setAllPages,
  type PageSection,
} from '../shared/settings'
import {
  applySectionBlocking,
  clearAllBlocking,
  isSectionBlocked,
  setSectionBlocked,
} from './blocking'
import { getRouteSections } from './routes'
import { BLOCKED_SECTION_ATTRS } from './selectors'

const blockedSections = () => {
  return PAGE_SECTIONS.filter(isSectionBlocked)
}

const HOME = getRouteSections('/') as readonly PageSection[]

describe('applySectionBlocking', () => {
  it('blocks every enabled section the route allows', () => {
    applySectionBlocking(DEFAULT_SETTINGS, HOME)

    expect(blockedSections()).toEqual([
      'homeFeed',
      'homeStories',
      'homeSuggestions',
    ])
  })

  it('leaves a section the user unblocked visible', () => {
    applySectionBlocking({ ...DEFAULT_SETTINGS, homeStories: false }, HOME)

    expect(blockedSections()).toEqual(['homeFeed', 'homeSuggestions'])
  })

  it('clears what the previous route blocked', () => {
    applySectionBlocking(DEFAULT_SETTINGS, HOME)
    applySectionBlocking(DEFAULT_SETTINGS, ['reels'])

    expect(blockedSections()).toEqual(['reels'])

    applySectionBlocking(DEFAULT_SETTINGS, [])

    expect(blockedSections()).toEqual([])
  })

  it('blocks nothing when every section is off', () => {
    applySectionBlocking(setAllPages(DEFAULT_SETTINGS, false), HOME)

    expect(blockedSections()).toEqual([])
  })

  // Re-applying runs on every route check, so it must not churn the DOM.
  it('queues no mutation when nothing changed', () => {
    applySectionBlocking(DEFAULT_SETTINGS, HOME)

    const observer = new MutationObserver(() => undefined)
    observer.observe(document.documentElement, { attributes: true })
    applySectionBlocking(DEFAULT_SETTINGS, HOME)
    const records = observer.takeRecords()
    observer.disconnect()

    expect(records).toEqual([])
  })
})

describe('section attributes', () => {
  it('live on the root element', () => {
    setSectionBlocked('explore', true)

    expect(
      document.documentElement.hasAttribute(BLOCKED_SECTION_ATTRS.explore),
    ).toBe(true)
  })

  it('are all removed by clearAllBlocking', () => {
    PAGE_SECTIONS.forEach(section => setSectionBlocked(section, true))

    clearAllBlocking()

    expect(blockedSections()).toEqual([])
  })
})
