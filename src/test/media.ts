import { vi } from 'vitest'

const pausedByElement = new WeakMap<HTMLMediaElement, boolean>()

/**
 * jsdom implements no playback: `play()` and `pause()` only report "not
 * implemented" and `paused` is always true. This gives every media element a
 * working trio that fires `play` and `pause` the way a browser does, so media
 * code can be driven and asserted on. The spies are undone by
 * `vi.restoreAllMocks()` in the shared teardown.
 */
export const installMediaStub = () => {
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(
    function (this: HTMLMediaElement) {
      return pausedByElement.get(this) ?? true
    },
  )

  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    pausedByElement.set(this, false)
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })

  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    pausedByElement.set(this, true)
    this.dispatchEvent(new Event('pause'))
  })
}
