import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  PAGE_SECTIONS,
  SETTINGS_STORAGE_KEY,
  type ExtensionSettings,
} from '../shared/settings'
import { TOGGLE_SHORTCUT_STORAGE_KEY } from '../shared/shortcut'
import { getChromeMock } from '../test/chrome'
import {
  DIRECT_BODY,
  EXPLORE_SEARCH_BODY,
  HOME_BODY,
  REELS_BODY,
} from '../test/fixtures/instagram'
import { isSectionBlocked } from './blocking'
import { isBlockingReady, READY_FALLBACK_MS } from './blockingStyles'
import { OVERLAY_ID } from './overlay'

type ContentScriptModule = typeof import('./content-script')

let contentScript: ContentScriptModule | null = null

// Module state (settings, route sections, the observer) lives at module scope,
// so every test gets its own instance rather than the previous test's history.
const loadContentScript = async () => {
  vi.resetModules()
  contentScript = await import('./content-script')
  contentScript.initContentScript()
  return contentScript
}

const blockedSections = () => {
  return PAGE_SECTIONS.filter(isSectionBlocked)
}

const visit = (pathname: string, body = '') => {
  window.history.replaceState({}, '', pathname)
  if (body) {
    document.body.innerHTML = body
  }
}

// A client-side navigation the way Instagram does it, followed by the kind of
// DOM churn that comes with it, which is what the observer fallback sees.
const navigateByHistory = async (pathname: string) => {
  window.history.pushState({}, '', pathname)
  document.body.append(document.createElement('div'))
  await Promise.resolve()
}

const storedSettings = () => {
  return getChromeMock().storage.local.snapshot()[SETTINGS_STORAGE_KEY] as
    | ExtensionSettings
    | undefined
}

const seedSettings = (settings: Partial<ExtensionSettings>) => {
  getChromeMock().storage.local.seed({
    [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS, ...settings },
  })
}

const sendRuntimeMessage = (message: unknown) => {
  const sendResponse = vi.fn()
  getChromeMock().runtime.onMessage.emit(
    message,
    {} as chrome.runtime.MessageSender,
    sendResponse,
  )
  return sendResponse
}

const pressShortcut = (target: EventTarget = document) => {
  const event = new KeyboardEvent('keydown', {
    code: 'Digit9',
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  contentScript?.cleanupContentScript()
  contentScript = null
  delete (window as unknown as { navigation?: EventTarget }).navigation
})

describe('startup', () => {
  it('blocks the route from stored settings and clears the curtain', async () => {
    visit('/', HOME_BODY)
    seedSettings({ homeStories: false })

    await loadContentScript()

    expect(blockedSections()).toEqual(['homeFeed', 'homeSuggestions'])
    expect(isBlockingReady()).toBe(true)
  })

  it('blocks everything on a first run with nothing stored', async () => {
    visit('/reels/abc/', REELS_BODY)

    await loadContentScript()

    expect(blockedSections()).toEqual(['reels'])
  })

  it('does not rewrite storage just by loading', async () => {
    visit('/')

    await loadContentScript()

    expect(storedSettings()).toBeUndefined()
  })

  // The curtain hides every target until the gate clears, so a storage read
  // that never answers must not leave Instagram blank.
  it('falls back to the defaults when storage never answers', async () => {
    vi.useFakeTimers()
    visit('/')
    getChromeMock().storage.local.get.mockImplementation(() => undefined)

    await loadContentScript()
    expect(isBlockingReady()).toBe(false)

    vi.advanceTimersByTime(READY_FALLBACK_MS)

    expect(isBlockingReady()).toBe(true)
    expect(blockedSections()).toEqual([
      'homeFeed',
      'homeStories',
      'homeSuggestions',
    ])
  })
})

describe('following client-side navigation', () => {
  it('re-evaluates the route from the observer after a history push', async () => {
    vi.useFakeTimers()
    visit('/', HOME_BODY)
    await loadContentScript()

    await navigateByHistory('/reels/abc/')
    vi.advanceTimersByTime(100)

    expect(blockedSections()).toEqual(['reels'])

    await navigateByHistory('/direct/inbox/')
    vi.advanceTimersByTime(100)

    expect(blockedSections()).toEqual([])
  })

  it('ignores churn on a route with nothing to block', async () => {
    vi.useFakeTimers()
    visit('/direct/inbox/', DIRECT_BODY)
    await loadContentScript()

    document.body.append(document.createElement('div'))
    await Promise.resolve()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('coalesces a burst of route changes into one pass', async () => {
    vi.useFakeTimers()
    visit('/', HOME_BODY)
    await loadContentScript()

    await navigateByHistory('/reels/abc/')
    await navigateByHistory('/reels/def/')

    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(100)

    expect(blockedSections()).toEqual(['reels'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies immediately on popstate', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()

    visit('/explore/')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(blockedSections()).toEqual(['explore'])
  })

  it('applies immediately when the Navigation API reports a change', async () => {
    const navigation = new EventTarget()
    ;(window as unknown as { navigation: EventTarget }).navigation = navigation
    visit('/', HOME_BODY)
    await loadContentScript()

    visit('/explore/')
    navigation.dispatchEvent(new Event('currententrychange'))

    expect(blockedSections()).toEqual(['explore'])
  })

  // The story viewer opens over Home, which stays mounted underneath.
  it('keeps the previous sections through the story viewer', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()

    visit('/stories/some.user/123/')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(blockedSections()).toEqual([
      'homeFeed',
      'homeStories',
      'homeSuggestions',
    ])

    visit('/p/abc/')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(blockedSections()).toEqual([])
  })
})

describe('settings updates', () => {
  it('follows a storage change from another surface', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()

    getChromeMock().storage.local.set({
      [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS, homeFeed: false },
    })

    expect(blockedSections()).toEqual(['homeStories', 'homeSuggestions'])
  })

  it('ignores other storage areas and unrelated keys', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()

    getChromeMock().storage.onChanged.emit(
      {
        [SETTINGS_STORAGE_KEY]: {
          newValue: { ...DEFAULT_SETTINGS, homeFeed: false },
        },
      },
      'sync',
    )
    getChromeMock().storage.local.set({ unrelated: true })

    expect(isSectionBlocked('homeFeed')).toBe(true)
  })

  it('applies settings sent by the popup', async () => {
    visit('/reels/', REELS_BODY)
    await loadContentScript()

    const sendResponse = sendRuntimeMessage({
      action: 'updateSettings',
      settings: { ...DEFAULT_SETTINGS, reels: false },
    })

    expect(blockedSections()).toEqual([])
    expect(sendResponse).toHaveBeenCalledWith({ success: true })
  })

  it('ignores messages it does not understand', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()

    const sendResponse = sendRuntimeMessage({ action: 'somethingElse' })
    sendRuntimeMessage('not even an object')

    expect(sendResponse).not.toHaveBeenCalled()
    expect(isSectionBlocked('homeFeed')).toBe(true)
  })
})

describe('toggling the current page', () => {
  it('flips every section of the route and saves the result', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()

    const sendResponse = sendRuntimeMessage({
      action: 'toggleCurrentPageBlock',
    })

    expect(sendResponse).toHaveBeenCalledWith({ success: true })
    expect(blockedSections()).toEqual([])
    expect(storedSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      homeFeed: false,
      homeStories: false,
      homeSuggestions: false,
    })
  })

  it('turns a partly blocked route fully on', async () => {
    visit('/', HOME_BODY)
    seedSettings({ homeStories: false })
    await loadContentScript()

    sendRuntimeMessage({ action: 'toggleCurrentPageBlock' })

    expect(blockedSections()).toEqual([
      'homeFeed',
      'homeStories',
      'homeSuggestions',
    ])
  })

  it('reports failure where there is nothing to toggle', async () => {
    visit('/direct/inbox/')
    await loadContentScript()

    expect(
      sendRuntimeMessage({ action: 'toggleCurrentPageBlock' }),
    ).toHaveBeenCalledWith({ success: false })

    visit('/stories/some.user/')
    expect(
      sendRuntimeMessage({ action: 'toggleCurrentPageBlock' }),
    ).toHaveBeenCalledWith({ success: false })
    expect(storedSettings()).toBeUndefined()
  })

  it('toggles from the in-page shortcut', async () => {
    visit('/explore/')
    await loadContentScript()

    const event = pressShortcut()

    expect(event.defaultPrevented).toBe(true)
    expect(blockedSections()).toEqual([])
  })

  it('leaves the shortcut to the page on a route with nothing to toggle', async () => {
    visit('/direct/inbox/')
    await loadContentScript()

    expect(pressShortcut().defaultPrevented).toBe(false)
  })

  it('never fires while typing', async () => {
    visit('/explore/')
    await loadContentScript()

    for (const tag of ['input', 'textarea', 'select']) {
      const field = document.createElement(tag)
      document.body.append(field)

      pressShortcut(field)

      expect(isSectionBlocked('explore'), tag).toBe(true)
    }
  })

  it('answers the binding the browser actually resolved', async () => {
    visit('/explore/')
    getChromeMock().storage.local.seed({
      [TOGGLE_SHORTCUT_STORAGE_KEY]: 'Alt+Shift+P',
    })
    await loadContentScript()

    pressShortcut()
    expect(isSectionBlocked('explore')).toBe(true)

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyP',
        altKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    )
    expect(isSectionBlocked('explore')).toBe(false)

    getChromeMock().storage.local.set({ [TOGGLE_SHORTCUT_STORAGE_KEY]: '' })
    pressShortcut()
    expect(isSectionBlocked('explore')).toBe(true)
  })

  // One keypress can reach both the in-page listener and the browser command.
  it('does not toggle twice for one keypress', async () => {
    visit('/explore/')
    await loadContentScript()

    pressShortcut()
    const sendResponse = sendRuntimeMessage({
      action: 'toggleCurrentPageBlock',
    })

    expect(sendResponse).toHaveBeenCalledWith({ success: true })
    expect(isSectionBlocked('explore')).toBe(false)
  })
})

describe('media', () => {
  const reelsVideo = () => {
    const video = document.querySelector<HTMLVideoElement>(
      '[data-virtualized] video',
    )
    if (!video) {
      throw new Error('Reels fixture has no player video')
    }
    return video
  }

  it('silences the Reels player and gives it back when unblocked', async () => {
    visit('/reels/abc/', REELS_BODY)
    const video = reelsVideo()
    video.muted = false
    await video.play()

    await loadContentScript()

    expect(video.paused).toBe(true)
    expect(video.muted).toBe(true)

    getChromeMock().storage.local.set({
      [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS, reels: false },
    })

    expect(video.paused).toBe(false)
    expect(video.muted).toBe(false)
  })

  it('silences a video Instagram mounts after startup', async () => {
    vi.useFakeTimers()
    visit('/', HOME_BODY)
    await loadContentScript()
    const video = document.createElement('video')
    await video.play()

    document.querySelector('main[role="main"] article')?.append(video)
    await Promise.resolve()
    vi.advanceTimersByTime(100)

    expect(video.paused).toBe(true)
  })

  // Instagram can leave `/reels/<id>/` in the address bar after Messages has
  // rendered. A reel shared in a thread must keep playing.
  it('leaves Messages media alone under a stale Reels URL', async () => {
    visit('/reels/abc/', DIRECT_BODY)
    const video = document.createElement('video')
    document.querySelector('[aria-label="Thread list"]')?.append(video)
    await video.play()

    await loadContentScript()

    expect(isSectionBlocked('reels')).toBe(true)
    expect(video.paused).toBe(false)
    expect(document.getElementById(OVERLAY_ID)).toBeNull()
  })

  it('gives media back and removes the card on cleanup', async () => {
    visit('/reels/abc/', REELS_BODY)
    const video = reelsVideo()
    await video.play()
    const script = await loadContentScript()
    expect(document.getElementById(OVERLAY_ID)).not.toBeNull()

    script.cleanupContentScript()

    expect(video.paused).toBe(false)
    expect(document.getElementById(OVERLAY_ID)).toBeNull()
  })
})

describe('the in-page card', () => {
  it('unblocks the Home feed from its switch and blocks it again from the button', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()

    const toggle = screen.getByRole('checkbox', { name: 'Block Home feed' })
    expect(toggle).toBeChecked()

    await userEvent.click(toggle)

    expect(storedSettings()).toMatchObject({
      homeFeed: false,
      homeStories: true,
      homeSuggestions: true,
    })
    expect(isSectionBlocked('homeFeed')).toBe(false)

    await userEvent.click(
      screen.getByRole('button', { name: 'Block Home feed' }),
    )

    expect(storedSettings()).toMatchObject({ homeFeed: true })
    expect(isSectionBlocked('homeFeed')).toBe(true)
  })

  it('stays away when the overlay is switched off', async () => {
    visit('/', HOME_BODY)
    seedSettings({ overlay: false })

    await loadContentScript()

    expect(document.getElementById(OVERLAY_ID)).toBeNull()
    expect(isSectionBlocked('homeFeed')).toBe(true)
  })

  it('stays away from routes without a card', async () => {
    visit('/direct/inbox/', DIRECT_BODY)
    await loadContentScript()

    expect(document.getElementById(OVERLAY_ID)).toBeNull()
  })

  it('leaves the story viewer uncovered', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()
    expect(document.getElementById(OVERLAY_ID)).not.toBeNull()

    visit('/stories/some.user/')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(document.getElementById(OVERLAY_ID)).toBeNull()
  })

  it('stays away while Explore search is in use', async () => {
    visit('/explore/', EXPLORE_SEARCH_BODY)
    await loadContentScript()

    expect(isSectionBlocked('explore')).toBe(true)
    expect(document.getElementById(OVERLAY_ID)).toBeNull()
  })

  it('appears once Instagram has rendered the feed', async () => {
    vi.useFakeTimers()
    visit('/')
    await loadContentScript()
    expect(document.getElementById(OVERLAY_ID)).toBeNull()

    document.body.innerHTML = HOME_BODY
    await Promise.resolve()
    vi.advanceTimersByTime(100)

    expect(document.getElementById(OVERLAY_ID)).not.toBeNull()
  })

  it('does nothing from a stale card once the route has no section', async () => {
    visit('/', HOME_BODY)
    await loadContentScript()
    const toggle = screen.getByRole('checkbox', { name: 'Block Home feed' })

    window.history.replaceState({}, '', '/direct/inbox/')
    await userEvent.click(toggle)

    expect(storedSettings()).toBeUndefined()
  })
})

describe('cleanup', () => {
  it('cancels a route check that was still pending', async () => {
    vi.useFakeTimers()
    visit('/', HOME_BODY)
    const script = await loadContentScript()
    await navigateByHistory('/reels/abc/')
    expect(vi.getTimerCount()).toBe(1)

    script.cleanupContentScript()
    vi.advanceTimersByTime(100)

    expect(vi.getTimerCount()).toBe(0)
    expect(isSectionBlocked('reels')).toBe(false)
  })

  it('marks the page ready and stops listening', async () => {
    vi.useFakeTimers()
    visit('/', HOME_BODY)
    getChromeMock().storage.local.get.mockImplementation(() => undefined)
    const script = await loadContentScript()
    const navigation = new EventTarget()

    script.cleanupContentScript()

    expect(isBlockingReady()).toBe(true)

    getChromeMock().storage.local.set({
      [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS, homeFeed: false },
    })
    await navigateByHistory('/reels/')
    window.dispatchEvent(new PopStateEvent('popstate'))
    navigation.dispatchEvent(new Event('currententrychange'))
    pressShortcut()
    vi.advanceTimersByTime(READY_FALLBACK_MS)

    expect(blockedSections()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})
