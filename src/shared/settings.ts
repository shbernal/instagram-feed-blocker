export const SETTINGS_STORAGE_KEY = 'extensionSettings'

export type ExtensionSettings = {
  active: boolean
  overlay: boolean
  homeFeed: boolean
  homeStories: boolean
  homeSuggestions: boolean
  explore: boolean
  reels: boolean
}

export type PageSection =
  | 'homeFeed'
  | 'homeStories'
  | 'homeSuggestions'
  | 'explore'
  | 'reels'

// `overlay` is a setting but deliberately not a section: everything below that
// iterates this list treats each member as blockable, so listing it here would
// make "Block all sections" switch the in-page card off too.
export const PAGE_SECTIONS: readonly PageSection[] = [
  'homeFeed',
  'homeStories',
  'homeSuggestions',
  'explore',
  'reels',
]

export const DEFAULT_SETTINGS: ExtensionSettings = {
  active: true,
  overlay: true,
  homeFeed: true,
  homeStories: true,
  homeSuggestions: true,
  explore: true,
  reels: true,
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const readBoolean = (value: unknown, fallback: boolean) => {
  return typeof value === 'boolean' ? value : fallback
}

export const isAnyPageActive = (settings: ExtensionSettings) => {
  return PAGE_SECTIONS.some(section => settings[section])
}

export const isAllPagesActive = (settings: ExtensionSettings) => {
  return PAGE_SECTIONS.every(section => settings[section])
}

/**
 * `active` is never stored as a choice of its own. It only answers whether
 * anything is blocked, so it is recomputed from the sections on every write.
 */
export const syncActiveWithPages = (
  settings: ExtensionSettings,
): ExtensionSettings => {
  return {
    ...settings,
    active: isAnyPageActive(settings),
  }
}

export const setAllPages = (
  settings: ExtensionSettings,
  enabled: boolean,
): ExtensionSettings => {
  const next = { ...settings }
  PAGE_SECTIONS.forEach(section => {
    next[section] = enabled
  })

  return syncActiveWithPages(next)
}

/**
 * Turns any stored value into a complete settings object. The result is an
 * explicit literal on purpose: a field missing from it is dropped on every
 * read, so a new setting has to be added here or it never persists.
 */
export const normalizeSettings = (
  value: unknown,
  fallback: ExtensionSettings = DEFAULT_SETTINGS,
): ExtensionSettings => {
  if (!isRecord(value)) {
    return syncActiveWithPages({ ...fallback })
  }

  return syncActiveWithPages({
    active: fallback.active,
    overlay: readBoolean(value.overlay, fallback.overlay),
    homeFeed: readBoolean(value.homeFeed, fallback.homeFeed),
    homeStories: readBoolean(value.homeStories, fallback.homeStories),
    homeSuggestions: readBoolean(
      value.homeSuggestions,
      fallback.homeSuggestions,
    ),
    explore: readBoolean(value.explore, fallback.explore),
    reels: readBoolean(value.reels, fallback.reels),
  })
}
