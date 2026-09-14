import { afterEach, describe, expect, it } from 'vitest'
import {
  DIRECT_BODY,
  EXPLORE_BODY,
  HOME_BODY,
  REELS_BODY,
} from '../test/fixtures/instagram'
import {
  restoreAllManagedMedia,
  startMediaGuard,
  stopMediaGuard,
  syncSectionMedia,
} from './media'
import { SECTION_MEDIA_SELECTORS } from './selectors'

const render = (body: string) => {
  document.body.innerHTML = body
}

const firstVideo = (selector: string) => {
  const video = document.querySelector<HTMLVideoElement>(selector)
  if (!video) {
    throw new Error(`Fixture has no video for ${selector}`)
  }
  return video
}

const playing = async (video: HTMLVideoElement, muted = false) => {
  video.muted = muted
  await video.play()
  return video
}

afterEach(() => {
  stopMediaGuard()
})

describe('syncSectionMedia', () => {
  it('finds media in every section that declares some', () => {
    for (const [body, section] of [
      [HOME_BODY, 'homeFeed'],
      [EXPLORE_BODY, 'explore'],
      [REELS_BODY, 'reels'],
    ] as const) {
      render(body)

      expect(
        document.querySelectorAll(SECTION_MEDIA_SELECTORS[section].join(', '))
          .length,
        section,
      ).toBeGreaterThan(0)
    }
  })

  it('pauses and mutes what a blocked section covers', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))

    syncSectionMedia(['reels'])

    expect(video.paused).toBe(true)
    expect(video.muted).toBe(true)
  })

  it('leaves media of sections that are not blocked alone', async () => {
    render(HOME_BODY)
    const video = await playing(firstVideo('main[role="main"] article video'))

    syncSectionMedia(['homeStories', 'homeSuggestions'])

    expect(video.paused).toBe(false)
    expect(video.muted).toBe(false)
  })

  it('gives back exactly what it took once the section is unblocked', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))

    syncSectionMedia(['reels'])
    syncSectionMedia([])

    expect(video.paused).toBe(false)
    expect(video.muted).toBe(false)
  })

  it('does not start a video that was not playing', () => {
    render(REELS_BODY)
    const video = firstVideo('[data-virtualized] video')
    video.muted = true

    syncSectionMedia(['reels'])
    syncSectionMedia([])

    expect(video.paused).toBe(true)
    expect(video.muted).toBe(true)
  })

  // A second sweep sees the video already silenced by this extension. Recording
  // that would make the eventual restore give back silence.
  it('records the original state only once across sweeps', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))

    syncSectionMedia(['reels'])
    syncSectionMedia(['reels'])
    syncSectionMedia([])

    expect(video.paused).toBe(false)
    expect(video.muted).toBe(false)
  })

  it('never touches a video outside the section scope', async () => {
    render(DIRECT_BODY)
    const video = document.createElement('video')
    document.querySelector('[aria-label="Thread list"]')?.append(video)
    await playing(video)

    syncSectionMedia(['reels', 'explore', 'homeFeed'])

    expect(video.paused).toBe(false)
  })

  it('gives back a video that has moved out of scope', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))

    syncSectionMedia(['reels'])
    document.body.append(video)
    syncSectionMedia(['reels'])

    expect(video.paused).toBe(false)
  })
})

describe('restoreAllManagedMedia', () => {
  it('gives everything back regardless of scope', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))
    syncSectionMedia(['reels'])

    restoreAllManagedMedia()

    expect(video.paused).toBe(false)
    expect(video.muted).toBe(false)
  })
})

describe('the play guard', () => {
  it('pauses a silenced video that starts again', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))
    startMediaGuard()
    syncSectionMedia(['reels'])

    await video.play()

    expect(video.paused).toBe(true)
  })

  it('leaves media it does not manage alone', async () => {
    render(REELS_BODY)
    startMediaGuard()

    const video = await playing(firstVideo('[data-virtualized] video'))

    expect(video.paused).toBe(false)
  })

  it('does not fight the resume on restore', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))
    startMediaGuard()
    syncSectionMedia(['reels'])

    syncSectionMedia([])

    expect(video.paused).toBe(false)
  })

  it('stops once removed', async () => {
    render(REELS_BODY)
    const video = await playing(firstVideo('[data-virtualized] video'))
    startMediaGuard()
    syncSectionMedia(['reels'])
    stopMediaGuard()

    await video.play()

    expect(video.paused).toBe(false)
  })
})
