import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  PAGE_SECTIONS,
  SETTINGS_STORAGE_KEY,
  syncActiveWithPages,
  type ExtensionSettings,
  type PageSection,
} from '../shared/settings'
import {
  matchesShortcut,
  resolveToggleShortcut,
  TOGGLE_SHORTCUT_STORAGE_KEY,
  type ParsedShortcut,
} from '../shared/shortcut'
import {
  applySectionBlocking,
  clearAllBlocking,
  isSectionBlocked,
} from './blocking'
import { markBlockingReady, READY_FALLBACK_MS } from './blockingStyles'
import {
  restoreAllManagedMedia,
  startMediaGuard,
  stopMediaGuard,
  syncSectionMedia,
} from './media'
import {
  removeOverlay,
  removeOverlayStyles,
  renderOverlay,
  type OverlayHandlers,
} from './overlay'
import { getRoutePrimarySection, getRouteSections } from './routes'
import { SECTION_SELECTORS } from './selectors'

type UpdateSettingsMessage = {
  action: 'updateSettings'
  settings: ExtensionSettings
}

type ToggleCurrentPageBlockMessage = {
  action: 'toggleCurrentPageBlock'
}

// Only the part of the Navigation API this script uses, so it does not depend
// on which DOM lib version declares the rest.
type NavigationEvents = {
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

const SHORTCUT_DUPLICATE_WINDOW_MS = 500

// Instagram re-renders constantly, so a pass is scheduled rather than run per
// mutation. One pending timer at a time collapses a burst of churn into a
// single pass.
const REAPPLY_DELAY_MS = 100

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS }
let toggleShortcut: ParsedShortcut | null = resolveToggleShortcut(undefined)
let routeSections: readonly PageSection[] = []
let appliedPathname: string | null = null
let observer: MutationObserver | null = null
let reapplyTimeoutId: number | null = null
let readyFallbackTimeoutId: number | null = null
let lastShortcutToggleAt = 0

const getNavigation = () => {
  return (window as unknown as { navigation?: NavigationEvents }).navigation
}

const isUpdateSettingsMessage = (
  message: unknown,
): message is UpdateSettingsMessage => {
  return (
    typeof message === 'object' &&
    message !== null &&
    'action' in message &&
    'settings' in message &&
    (message as { action: unknown }).action === 'updateSettings'
  )
}

const isToggleCurrentPageBlockMessage = (
  message: unknown,
): message is ToggleCurrentPageBlockMessage => {
  return (
    typeof message === 'object' &&
    message !== null &&
    'action' in message &&
    (message as { action: unknown }).action === 'toggleCurrentPageBlock'
  )
}

const saveSettings = (nextSettings: ExtensionSettings) => {
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: syncActiveWithPages(nextSettings),
  })
}

const setPrimarySectionBlocked = (blocked: boolean) => {
  const section = getRoutePrimarySection(window.location.pathname)
  if (section === null) {
    return
  }

  settings = syncActiveWithPages({ ...settings, [section]: blocked })
  saveSettings(settings)
  applyCurrentSettings()
}

// A stable singleton, since the overlay keeps whatever it is handed.
const overlayHandlers: OverlayHandlers = {
  onToggle: blocked => {
    setPrimarySectionBlocked(blocked)
  },
  onBlock: () => {
    setPrimarySectionBlocked(true)
  },
}

// The card only makes sense where its section's targets are actually on the
// page. That keeps it off Messages under Instagram's stale `/reels/<id>/` URL,
// off Explore while search is in use, and away until Instagram has rendered.
const syncOverlay = () => {
  const section = getRoutePrimarySection(window.location.pathname)
  const onPage =
    section !== null &&
    SECTION_SELECTORS[section].some(
      selector => document.querySelector(selector) !== null,
    )

  if (!settings.overlay || section === null || !onPage) {
    removeOverlay()
    return
  }

  renderOverlay(settings, overlayHandlers, section)
}

function applyCurrentSettings() {
  const pathname = window.location.pathname
  const sections = getRouteSections(pathname)

  // A transparent route overlays the page it was opened from, which is still
  // mounted underneath, so the sections that page had stay as they were.
  if (sections !== null) {
    routeSections = sections
  }

  appliedPathname = pathname
  applySectionBlocking(settings, routeSections)
  syncSectionMedia(PAGE_SECTIONS.filter(isSectionBlocked))
  syncOverlay()
}

const cancelReadyFallback = () => {
  if (readyFallbackTimeoutId !== null) {
    window.clearTimeout(readyFallbackTimeoutId)
    readyFallbackTimeoutId = null
  }
}

// The stylesheet's curtain hides every target until this runs, so whatever
// happens the gate has to end up cleared.
const finishStartup = () => {
  cancelReadyFallback()
  markBlockingReady()
}

const cancelScheduledApply = () => {
  if (reapplyTimeoutId !== null) {
    window.clearTimeout(reapplyTimeoutId)
    reapplyTimeoutId = null
  }
}

const scheduleApply = () => {
  if (reapplyTimeoutId !== null) {
    return
  }

  reapplyTimeoutId = window.setTimeout(() => {
    reapplyTimeoutId = null
    applyCurrentSettings()
  }, REAPPLY_DELAY_MS)
}

const toggleCurrentPageBlock = () => {
  const sections = getRouteSections(window.location.pathname)
  if (sections === null || sections.length === 0) {
    return false
  }

  const nextValue = sections.some(section => !settings[section])
  const nextSettings = { ...settings }

  sections.forEach(section => {
    nextSettings[section] = nextValue
  })

  settings = syncActiveWithPages(nextSettings)
  saveSettings(settings)
  applyCurrentSettings()
  return true
}

const wasRecentlyToggledByShortcut = () => {
  return Date.now() - lastShortcutToggleAt < SHORTCUT_DUPLICATE_WINDOW_MS
}

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'select' ||
    tagName === 'textarea'
  )
}

const onKeyDown = (event: KeyboardEvent) => {
  if (!matchesShortcut(event, toggleShortcut)) {
    return
  }

  if (isTextInputTarget(event.target)) {
    return
  }

  lastShortcutToggleAt = Date.now()
  if (toggleCurrentPageBlock()) {
    event.preventDefault()
    event.stopPropagation()
  }
}

const onRuntimeMessage: Parameters<
  typeof chrome.runtime.onMessage.addListener
>[0] = (message, _sender, sendResponse) => {
  if (isUpdateSettingsMessage(message)) {
    settings = normalizeSettings(message.settings, settings)
    applyCurrentSettings()

    sendResponse({ success: true })
    return false
  }

  if (isToggleCurrentPageBlockMessage(message)) {
    // The browser command and the in-page listener can both see one keypress.
    if (wasRecentlyToggledByShortcut()) {
      sendResponse({ success: true })
      return false
    }

    sendResponse({ success: toggleCurrentPageBlock() })
    return false
  }

  return false
}

const onStorageChanged: Parameters<
  typeof chrome.storage.onChanged.addListener
>[0] = (changes, areaName) => {
  if (areaName !== 'local') {
    return
  }

  const shortcutChange = changes[TOGGLE_SHORTCUT_STORAGE_KEY]
  if (shortcutChange) {
    toggleShortcut = resolveToggleShortcut(shortcutChange.newValue)
  }

  const settingsChange = changes[SETTINGS_STORAGE_KEY]
  if (!settingsChange) {
    return
  }

  settings = normalizeSettings(settingsChange.newValue, settings)
  applyCurrentSettings()
}

// Instagram navigates with the History API. The Navigation API reports that
// synchronously where the content script can see it, `popstate` covers back
// and forward, and the observer below is the fallback for engines that report
// neither.
const onNavigation = () => {
  applyCurrentSettings()
}

const setupObserver = () => {
  observer = new MutationObserver(mutations => {
    if (window.location.pathname !== appliedPathname) {
      scheduleApply()
      return
    }

    // Hiding is CSS and needs nothing from here. What does is a video to
    // silence, or the card's target, appearing where a route has sections;
    // routes without any only care whether the route moved.
    if (
      routeSections.length > 0 &&
      mutations.some(mutation => mutation.addedNodes.length > 0)
    ) {
      scheduleApply()
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

export const initContentScript = () => {
  // A storage read that never returns still has to clear the curtain. It does
  // so with the defaults applied, so the page lands blocked rather than open.
  // Armed before the read, because a read that answers at once would otherwise
  // finish startup before there is a timer to cancel.
  readyFallbackTimeoutId = window.setTimeout(() => {
    applyCurrentSettings()
    finishStartup()
  }, READY_FALLBACK_MS)

  chrome.storage.local.get(
    [SETTINGS_STORAGE_KEY, TOGGLE_SHORTCUT_STORAGE_KEY],
    result => {
      toggleShortcut = resolveToggleShortcut(
        result[TOGGLE_SHORTCUT_STORAGE_KEY],
      )
      settings = normalizeSettings(result[SETTINGS_STORAGE_KEY])
      applyCurrentSettings()
      finishStartup()
    },
  )

  chrome.runtime.onMessage.addListener(onRuntimeMessage)
  chrome.storage.onChanged.addListener(onStorageChanged)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('popstate', onNavigation)
  getNavigation()?.addEventListener('currententrychange', onNavigation)
  startMediaGuard()
  setupObserver()
}

export const cleanupContentScript = () => {
  // Set, never cleared: an unloaded extension must not leave the page hidden.
  finishStartup()

  chrome.runtime.onMessage.removeListener(onRuntimeMessage)
  chrome.storage.onChanged.removeListener(onStorageChanged)
  document.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('popstate', onNavigation)
  getNavigation()?.removeEventListener('currententrychange', onNavigation)
  stopMediaGuard()

  if (observer) {
    observer.disconnect()
    observer = null
  }

  cancelScheduledApply()
  removeOverlay()
  removeOverlayStyles()
  restoreAllManagedMedia()
}

// Importing this module must not touch the page, so the unit tests in jsdom can
// drive `initContentScript`/`cleanupContentScript` per test case. At
// `document_start` the root element already exists, which is all this needs.
if (import.meta.env.MODE !== 'test' && typeof chrome !== 'undefined') {
  initContentScript()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupContentScript()
    clearAllBlocking()
  })
}
