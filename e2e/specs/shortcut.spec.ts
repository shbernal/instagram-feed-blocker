import { test, expect } from '../fixtures/extension'
import { NOTHING_BLOCKED } from '../fixtures/settings'

const INSTAGRAM = 'https://www.instagram.com'

// `chrome.commands` is not exposed to content scripts, so the in-page keydown
// fallback can only answer the right keys if the background script mirrored
// the live binding into storage first. This is that whole round trip.
test('the toggle shortcut blocks and restores the current page', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
  readSettings,
  readToggleShortcut,
}) => {
  await clearSettings()
  await seedSettings(NOTHING_BLOCKED)
  await expect.poll(readToggleShortcut).toBe('Ctrl+Shift+9')

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/`)
  const article = page.locator('main[role="main"] article').first()
  await expect(article).toBeVisible()

  await page.bringToFront()
  await page.keyboard.press('Control+Shift+9')

  await expect(article).toBeHidden()
  await expect(page.locator('[data-pagelet="story_tray"]')).toBeHidden()
  await expect.poll(readSettings).toMatchObject({
    active: true,
    homeFeed: true,
    homeStories: true,
    homeSuggestions: true,
  })

  await page.keyboard.press('Control+Shift+9')

  await expect(article).toBeVisible()
  await expect.poll(readSettings).toMatchObject({
    active: false,
    homeFeed: false,
    homeStories: false,
    homeSuggestions: false,
  })
})

test('the toggle shortcut does nothing on a page with no sections', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
  readSettings,
}) => {
  await clearSettings()
  await seedSettings(NOTHING_BLOCKED)

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/direct/inbox/`)
  await expect(page.locator('html')).toHaveAttribute('data-igfb-ready', 'true')

  await page.bringToFront()
  await page.keyboard.press('Control+Shift+9')

  await expect(page.locator('[aria-label="Thread list"]')).toBeVisible()
  await expect.poll(readSettings).toEqual(NOTHING_BLOCKED)
})
