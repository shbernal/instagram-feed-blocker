import type { PageSection } from '../shared/settings'
import { SECTION_MEDIA_SELECTORS } from './selectors'

// Written together and read together: restore bails unless both are present,
// so a partial write can never strand an element silenced with no way back.
// Volume is left alone because muting is enough, and not touching it means
// there is nothing of the user's to get wrong on the way back.
const PREVIOUS_MUTED_ATTR = 'data-igfb-previous-muted'
const PREVIOUS_PAUSED_ATTR = 'data-igfb-previous-paused'
const MANAGED_SELECTOR = `[${PREVIOUS_MUTED_ATTR}]`

const isManaged = (media: HTMLMediaElement) => {
  return media.hasAttribute(PREVIOUS_MUTED_ATTR)
}

const silence = (media: HTMLMediaElement) => {
  // Recorded once. A later sweep sees the element already paused and muted by
  // this extension, which is not the state to give back.
  if (!isManaged(media)) {
    media.setAttribute(PREVIOUS_MUTED_ATTR, String(media.muted))
    media.setAttribute(PREVIOUS_PAUSED_ATTR, String(media.paused))
  }

  if (!media.muted) {
    media.muted = true
  }

  if (!media.paused) {
    media.pause()
  }
}

const restore = (media: HTMLMediaElement) => {
  const previousMuted = media.getAttribute(PREVIOUS_MUTED_ATTR)
  const previousPaused = media.getAttribute(PREVIOUS_PAUSED_ATTR)

  if (previousMuted === null || previousPaused === null) {
    return
  }

  // Unmarked before resuming, so the play guard below sees an element it no
  // longer manages instead of pausing it straight back.
  media.removeAttribute(PREVIOUS_MUTED_ATTR)
  media.removeAttribute(PREVIOUS_PAUSED_ATTR)

  media.muted = previousMuted === 'true'

  if (previousPaused === 'false' && media.paused) {
    void media.play().catch(() => {
      // Autoplay rules can refuse the resume; the mute state is back either way.
    })
  }
}

/**
 * Silences every video the blocked sections cover, and gives back every video
 * this extension silenced that they no longer cover: unblocked, left behind by
 * a route change, or moved out of scope. Driven by the same DOM-scoped
 * selectors as the stylesheet, so a stale route cannot reach media it does not
 * hide.
 */
export const syncSectionMedia = (blockedSections: readonly PageSection[]) => {
  const selectorList = blockedSections
    .flatMap(section => SECTION_MEDIA_SELECTORS[section])
    .join(', ')

  if (selectorList) {
    document.querySelectorAll<HTMLMediaElement>(selectorList).forEach(silence)
  }

  document
    .querySelectorAll<HTMLMediaElement>(MANAGED_SELECTOR)
    .forEach(media => {
      if (!selectorList || !media.matches(selectorList)) {
        restore(media)
      }
    })
}

export const restoreAllManagedMedia = () => {
  document.querySelectorAll<HTMLMediaElement>(MANAGED_SELECTOR).forEach(restore)
}

// Instagram restarts playback from its own visibility logic. A managed element
// is by definition still covered by a blocked section, because restore removes
// the mark, so pausing it again whenever it starts is always right. `play`
// does not bubble, hence the capture phase.
const onPlay = (event: Event) => {
  const target = event.target
  if (target instanceof HTMLMediaElement && isManaged(target)) {
    target.pause()
  }
}

export const startMediaGuard = () => {
  document.addEventListener('play', onPlay, true)
}

export const stopMediaGuard = () => {
  document.removeEventListener('play', onPlay, true)
}
