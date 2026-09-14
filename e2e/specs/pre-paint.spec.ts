import { test, expect } from '../fixtures/extension'
import { NOTHING_BLOCKED } from '../fixtures/settings'
import { CURTAIN_EXPIRY_MS, READY_ATTR } from '../../src/content/blockingStyles'

const INSTAGRAM = 'https://www.instagram.com'

// The claim the document_start stylesheet exists for, and the one jsdom cannot
// make: the targets are hidden before the extension has decided anything,
// rather than a moment after. The fixture records computed styles from an
// inline script that runs while the document is still parsing.
test('curtains the targets before the page is marked ready', async ({
  clearSettings,
  newInstagramPage,
}) => {
  await clearSettings()

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/?probe=parse-time`)

  const atParseTime = await page.evaluate(() => window.__igfbParseTime)

  expect(atParseTime).toEqual({
    ready: 'false',
    'main[role="main"] article': 'hidden',
    '[data-pagelet="story_tray"]': 'hidden',
  })
})

test('lifts the curtain once the settings are applied', async ({
  clearSettings,
  newInstagramPage,
}) => {
  await clearSettings()

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/`)

  await expect(page.locator('html')).toHaveAttribute(READY_ATTR, 'true')
})

// If the gate is never cleared the page stays hidden, a worse failure than the
// flash the stylesheet replaces, so the rule expires on its own. This drives
// that failure directly, because no test of a working extension reaches it.
//
// Nothing is blocked on purpose: an element the stylesheet has already set to
// `display: none` is not rendered and runs no animation, and if the content
// script never ran, no section attribute would be set either.
test('reveals the page on its own if the gate is never cleared', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(NOTHING_BLOCKED)

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/`)
  await expect(page.locator('html')).toHaveAttribute(READY_ATTR, 'true')

  const article = page.locator('main[role="main"] article').first()

  await page.evaluate(attribute => {
    document.documentElement.removeAttribute(attribute)
  }, READY_ATTR)

  await expect(article).toHaveCSS('visibility', 'hidden')
  await expect(article).toHaveCSS('visibility', 'visible', {
    timeout: CURTAIN_EXPIRY_MS * 2,
  })
})
