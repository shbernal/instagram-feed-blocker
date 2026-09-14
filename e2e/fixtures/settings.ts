import type { ExtensionSettings, PageSection } from '../../src/shared/settings'

export const NOTHING_BLOCKED: ExtensionSettings = {
  active: false,
  overlay: true,
  homeFeed: false,
  homeStories: false,
  homeSuggestions: false,
  explore: false,
  reels: false,
}

export const EVERYTHING_BLOCKED: ExtensionSettings = {
  active: true,
  overlay: true,
  homeFeed: true,
  homeStories: true,
  homeSuggestions: true,
  explore: true,
  reels: true,
}

export const only = (...sections: PageSection[]): ExtensionSettings => {
  const settings = { ...NOTHING_BLOCKED, active: sections.length > 0 }
  sections.forEach(section => {
    settings[section] = true
  })
  return settings
}
