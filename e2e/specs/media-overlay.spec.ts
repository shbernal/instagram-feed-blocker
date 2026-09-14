import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/extension'
import { EVERYTHING_BLOCKED, NOTHING_BLOCKED, only } from '../fixtures/settings'

const INSTAGRAM = 'https://www.instagram.com'
const PLAYER_VIDEO = '[data-virtualized] video'

const videoMuted = (page: Page) => {
  return page.evaluate(selector => {
    return document.querySelector<HTMLVideoElement>(selector)?.muted
  }, PLAYER_VIDEO)
}

// Fixture media has no source, so nothing actually plays here. Pause and
// resume are covered in jsdom; what a real browser adds is that the muted
// state is taken and given back through the running extension.
test('mutes the Reels player only while Reels is blocked', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(NOTHING_BLOCKED)

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/reels/abc/`)
  await page.evaluate(selector => {
    const video = document.querySelector<HTMLVideoElement>(selector)
    if (video) {
      video.muted = false
    }
  }, PLAYER_VIDEO)

  await seedSettings(only('reels'))

  await expect.poll(() => videoMuted(page)).toBe(true)
  await expect(page.locator(PLAYER_VIDEO).first()).toHaveAttribute(
    'data-igfb-previous-muted',
    'false',
  )

  await seedSettings(NOTHING_BLOCKED)

  await expect.poll(() => videoMuted(page)).toBe(false)
  await expect(page.locator(PLAYER_VIDEO).first()).not.toHaveAttribute(
    'data-igfb-previous-muted',
  )
})

test('unblocks the Home feed from the card and blocks it again', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
  readSettings,
}) => {
  await clearSettings()
  await seedSettings(EVERYTHING_BLOCKED)

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/`)

  const article = page.locator('main[role="main"] article').first()
  await expect(article).toBeHidden()
  await expect(page.locator('#igfb-overlay')).toContainText('Block Home feed')

  await page.locator('#igfb-overlay .igfb-switch').click()

  await expect(article).toBeVisible()
  await expect.poll(readSettings).toMatchObject({
    homeFeed: false,
    homeStories: true,
    homeSuggestions: true,
  })

  await page.getByRole('button', { name: 'Block Home feed' }).click()

  await expect(article).toBeHidden()
  await expect.poll(readSettings).toMatchObject({ homeFeed: true })
})

test('keeps the card away where it does not belong', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(EVERYTHING_BLOCKED)

  const page = await newInstagramPage()

  for (const path of [
    '/direct/inbox/',
    '/explore/?fixture=search',
    '/p/abc/',
  ]) {
    await page.goto(`${INSTAGRAM}${path}`)
    await expect(page.locator('html')).toHaveAttribute(
      'data-igfb-ready',
      'true',
    )

    await expect(page.locator('#igfb-overlay'), path).toHaveCount(0)
  }

  await seedSettings({ ...EVERYTHING_BLOCKED, overlay: false })
  await page.goto(`${INSTAGRAM}/`)

  await expect(page.locator('main[role="main"] article').first()).toBeHidden()
  await expect(page.locator('#igfb-overlay')).toHaveCount(0)
})
