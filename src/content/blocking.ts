import {
  PAGE_SECTIONS,
  type ExtensionSettings,
  type PageSection,
} from '../shared/settings'
import { BLOCKED_SECTION_ATTRS } from './selectors'

// Hiding is declarative: the stylesheet does the work, so blocking a section is
// one attribute write and anything Instagram mounts afterwards is hidden as it
// mounts. `toggleAttribute` with a force leaves an attribute that already has
// the requested state untouched, so re-applying is free and queues no
// mutation.
export const setSectionBlocked = (section: PageSection, blocked: boolean) => {
  document.documentElement.toggleAttribute(
    BLOCKED_SECTION_ATTRS[section],
    blocked,
  )
}

export const isSectionBlocked = (section: PageSection) => {
  return document.documentElement.hasAttribute(BLOCKED_SECTION_ATTRS[section])
}

/**
 * Blocks exactly the sections that are both enabled and allowed on the route,
 * and clears every other one, so leaving a route restores what it hid.
 */
export const applySectionBlocking = (
  settings: ExtensionSettings,
  routeSections: readonly PageSection[],
) => {
  PAGE_SECTIONS.forEach(section => {
    setSectionBlocked(
      section,
      routeSections.includes(section) && settings[section],
    )
  })
}

export const clearAllBlocking = () => {
  PAGE_SECTIONS.forEach(section => {
    setSectionBlocked(section, false)
  })
}
