import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type PageSection } from '../shared/settings'
import {
  DIRECT_BODY,
  EXPLORE_BODY,
  EXPLORE_SEARCH_BODY,
  HOME_BODY,
  HOME_NARROW_BODY,
  POST_BODY,
  PROFILE_BODY,
  REEL_BODY,
  REELS_BODY,
} from '../test/fixtures/instagram'
import { applySectionBlocking } from './blocking'
import { buildBlockingCss, markBlockingReady } from './blockingStyles'
import { SECTION_SELECTORS } from './selectors'

const render = (body: string) => {
  document.body.innerHTML = body
}

const matchesOf = (section: PageSection) => {
  return SECTION_SELECTORS[section].flatMap(selector =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)),
  )
}

const coveredBy = (element: Element, section: PageSection) => {
  return matchesOf(section).some(match => match.contains(element))
}

const all = (selector: string) => {
  return Array.from(document.querySelectorAll(selector))
}

const one = (selector: string) => {
  const element = document.querySelector(selector)
  if (!element) {
    throw new Error(`Fixture is missing ${selector}`)
  }
  return element
}

const byText = (text: string) => {
  const match = all('span, div, a, h1, h2').find(
    element =>
      element.children.length === 0 && element.textContent?.trim() === text,
  )
  if (!match) {
    throw new Error(`Fixture has no element reading "${text}"`)
  }
  return match
}

// What the page shows, as far as jsdom's cascade can say: an element is
// rendered when neither it nor any ancestor computes to `display: none`.
const isRendered = (element: Element) => {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    if (getComputedStyle(current).display === 'none') {
      return false
    }
  }
  return true
}

const installStylesheet = () => {
  const style = document.createElement('style')
  style.textContent = buildBlockingCss()
  document.head.appendChild(style)
}

describe('Home, wide layout', () => {
  it('covers the tabs and every post with the feed section', () => {
    render(HOME_BODY)

    expect(all('main[role="main"] article').length).toBeGreaterThan(0)
    all('main[role="main"] article').forEach(article => {
      expect(coveredBy(article, 'homeFeed')).toBe(true)
    })
    expect(coveredBy(one('[role="tablist"]'), 'homeFeed')).toBe(true)
  })

  it('keeps the feed, stories and suggestions apart', () => {
    render(HOME_BODY)
    const tray = one('[data-pagelet="story_tray"]')
    const seeAll = one('a[href="/explore/people/"]')

    expect(coveredBy(tray, 'homeFeed')).toBe(false)
    expect(coveredBy(seeAll, 'homeFeed')).toBe(false)
    expect(coveredBy(tray, 'homeStories')).toBe(true)
    expect(coveredBy(one('main[role="main"] article'), 'homeStories')).toBe(
      false,
    )
  })

  // The rail also holds the account switcher and the footer links, which are
  // not a recommendation loop and stay.
  it('hides only the suggestions block of the right rail', () => {
    render(HOME_BODY)

    expect(
      coveredBy(one('a[href="/explore/people/"]'), 'homeSuggestions'),
    ).toBe(true)
    expect(coveredBy(byText('Suggested for you'), 'homeSuggestions')).toBe(
      false,
    )
    expect(coveredBy(byText('Switch'), 'homeSuggestions')).toBe(false)
    expect(coveredBy(one('main[role="main"] nav'), 'homeSuggestions')).toBe(
      false,
    )
  })

  it('never reaches the navigation outside main', () => {
    render(HOME_BODY)

    for (const section of [
      'homeFeed',
      'homeStories',
      'homeSuggestions',
    ] as const) {
      expect(coveredBy(one('a[href="/direct/inbox/"]'), section)).toBe(false)
    }
  })
})

describe('Home, narrow layout', () => {
  it('still covers every post and the stories tray', () => {
    render(HOME_NARROW_BODY)

    expect(all('main[role="main"] article').length).toBeGreaterThan(0)
    all('main[role="main"] article').forEach(article => {
      expect(coveredBy(article, 'homeFeed')).toBe(true)
    })
    expect(coveredBy(one('[data-pagelet="story_tray"]'), 'homeStories')).toBe(
      true,
    )
  })

  it('leaves the header search box alone and has no rail to hide', () => {
    render(HOME_NARROW_BODY)
    const search = one('input[aria-label="Search input"]')

    expect(coveredBy(search, 'homeFeed')).toBe(false)
    expect(coveredBy(search, 'homeStories')).toBe(false)
    expect(matchesOf('homeSuggestions')).toEqual([])
  })
})

describe('Explore', () => {
  it('covers the tabs and every grid tile, but not the search box', () => {
    render(EXPLORE_BODY)

    expect(all('main[role="main"] a[href^="/p/"]').length).toBeGreaterThan(0)
    all('main[role="main"] a[href^="/p/"]').forEach(tile => {
      expect(coveredBy(tile, 'explore')).toBe(true)
    })
    expect(coveredBy(one('[role="tablist"]'), 'explore')).toBe(true)
    expect(coveredBy(one('input[aria-label="Search input"]'), 'explore')).toBe(
      false,
    )
  })

  // Focusing the search box folds the tabs and results into the slot that
  // holds the input. None of it may be hidden.
  it('matches nothing while search is in use', () => {
    render(EXPLORE_SEARCH_BODY)

    expect(all('main[role="main"] a[href]').length).toBeGreaterThan(0)
    expect(matchesOf('explore')).toEqual([])
  })
})

describe('Reels', () => {
  it('covers the whole player area and nothing outside main', () => {
    render(REELS_BODY)

    all('main[role="main"] video').forEach(video => {
      expect(coveredBy(video, 'reels')).toBe(true)
    })
    expect(coveredBy(one('a[href="/reels/"]'), 'reels')).toBe(false)
  })

  it('needs the mounted player, not just a main landmark', () => {
    for (const body of [POST_BODY, REEL_BODY, PROFILE_BODY, DIRECT_BODY]) {
      render(body)

      expect(matchesOf('reels')).toEqual([])
    }
  })
})

describe('the generated stylesheet', () => {
  it('hides a blocked section and leaves its neighbours rendered', () => {
    render(HOME_BODY)
    installStylesheet()
    markBlockingReady()

    applySectionBlocking({ ...DEFAULT_SETTINGS, homeStories: false }, [
      'homeFeed',
      'homeStories',
      'homeSuggestions',
    ])

    expect(isRendered(one('main[role="main"] article'))).toBe(false)
    expect(isRendered(one('a[href="/explore/people/"]'))).toBe(false)
    expect(isRendered(one('[data-pagelet="story_tray"]'))).toBe(true)
    expect(isRendered(byText('Switch'))).toBe(true)
    expect(isRendered(one('a[href="/direct/inbox/"]'))).toBe(true)
  })

  it('keeps Explore search usable while the grid is blocked', () => {
    render(EXPLORE_BODY)
    installStylesheet()
    markBlockingReady()

    applySectionBlocking(DEFAULT_SETTINGS, ['explore'])

    expect(isRendered(one('main[role="main"] a[href^="/p/"]'))).toBe(false)
    expect(isRendered(one('input[aria-label="Search input"]'))).toBe(true)
  })

  it('hides nothing on a route with no sections', () => {
    render(PROFILE_BODY)
    installStylesheet()
    markBlockingReady()

    applySectionBlocking(DEFAULT_SETTINGS, [])

    all('main[role="main"] *').forEach(element => {
      expect(isRendered(element)).toBe(true)
    })
  })

  // Leaving Reels shortly after opening it, Instagram rewrites the URL back to
  // `/reels/<id>/` after Messages has rendered, so the Reels section stays
  // applied over the inbox. Keying on the player is what keeps that harmless.
  it('keeps Messages visible under a stale Reels URL', () => {
    render(DIRECT_BODY)
    installStylesheet()
    markBlockingReady()

    applySectionBlocking(DEFAULT_SETTINGS, ['reels'])

    expect(isRendered(one('[aria-label="Thread list"]'))).toBe(true)
  })

  it('curtains the targets until the page is marked ready', () => {
    render(HOME_BODY)
    installStylesheet()

    expect(getComputedStyle(one('main[role="main"] article')).visibility).toBe(
      'hidden',
    )

    markBlockingReady()

    expect(
      getComputedStyle(one('main[role="main"] article')).visibility,
    ).not.toBe('hidden')
  })

  it('never curtains a page that has nothing to block', () => {
    render(POST_BODY)
    installStylesheet()

    expect(getComputedStyle(one('main[role="main"]')).visibility).not.toBe(
      'hidden',
    )
  })
})
