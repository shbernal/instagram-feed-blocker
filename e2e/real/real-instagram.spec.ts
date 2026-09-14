import type { Page, TestInfo } from '@playwright/test'
import { test, expect } from '../fixtures/realExtension'
import { assertSignedIn } from '../fixtures/instagramSession'
import { DEFAULT_SETTINGS } from '../../src/shared/settings'

// The selector-drift canary. Real Instagram, a real signed-in profile, the
// built extension: the only lane that notices Instagram changing its markup.
// Opt-in, because it needs `pnpm e2e:real:setup` first and CI has no account.
test.skip(
  process.env.RUN_REAL_INSTAGRAM_E2E !== '1',
  'Set RUN_REAL_INSTAGRAM_E2E=1 (pnpm e2e:real) to run against real Instagram',
)

const INSTAGRAM = 'https://www.instagram.com'
const ARTICLE = 'main[role="main"] article'
const OVERLAY = '#igfb-overlay'
const SEARCH = 'input[aria-label="Search input"]'
const REELS_PLAYER = 'main[role="main"]:has([data-virtualized] video)'

const visit = async (page: Page, path: string) => {
  await page.goto(`${INSTAGRAM}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
}

const checkpoint = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) })
}

const playingVideos = (page: Page) => {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll('video')).filter(
        video => !video.paused,
      ).length,
  )
}

const blockedAttributes = (page: Page) => {
  return page.evaluate(() =>
    Array.from(document.documentElement.attributes)
      .map(attribute => attribute.name)
      .filter(name => /^data-igfb-.+-blocked$/.test(name)),
  )
}

test.beforeEach(async ({ clearSettings, seedSettings }) => {
  await clearSettings()
  await seedSettings(DEFAULT_SETTINGS)
})

test.afterEach(async ({ seedSettings }) => {
  await seedSettings(DEFAULT_SETTINGS)
})

test('blocks Home and restores it from the in-page card', async ({
  newRealInstagramPage,
  readSettings,
}, testInfo) => {
  const page = await newRealInstagramPage()
  await visit(page, '/')
  await assertSignedIn(page)

  await expect(page.locator(OVERLAY)).toContainText('Block Home feed')
  await expect(page.locator(ARTICLE).first()).toBeHidden()
  await expect(page.locator('[data-pagelet="story_tray"]')).toBeHidden()
  await expect(page.locator('a[href="/direct/inbox/"]').first()).toBeVisible()
  await checkpoint(page, testInfo, '01-home-blocked')

  await page.locator(`${OVERLAY} .igfb-switch`).click()

  await expect(page.locator(ARTICLE).first()).toBeVisible()
  await expect.poll(readSettings).toMatchObject({ homeFeed: false })
  await checkpoint(page, testInfo, '02-home-unblocked')

  await page.getByRole('button', { name: 'Block Home feed' }).click()

  await expect(page.locator(ARTICLE).first()).toBeHidden()
  await expect.poll(readSettings).toMatchObject({ homeFeed: true })
})

test('hides the Explore grid and keeps search usable', async ({
  newRealInstagramPage,
}, testInfo) => {
  const page = await newRealInstagramPage()
  await visit(page, '/explore/')
  await assertSignedIn(page)

  const tile = page.locator('main[role="main"] a[href^="/p/"]').first()
  await expect(tile).toBeAttached({ timeout: 30_000 })
  await expect(tile).toBeHidden()
  await expect(page.locator(SEARCH).first()).toBeVisible()
  await expect.poll(() => playingVideos(page)).toBe(0)
  await checkpoint(page, testInfo, '03-explore-blocked')

  await page.locator(SEARCH).first().focus()
  await page.keyboard.type('guitar', { delay: 80 })

  await expect(page.locator('main[role="main"] a[href]').first()).toBeVisible()
  await expect(page.locator(OVERLAY)).toHaveCount(0)
  await checkpoint(page, testInfo, '04-explore-searching')
})

// Also the stale-URL case: leaving Reels soon after opening it, Instagram can
// rewrite the address back to `/reels/<id>/` over Messages. The thread list
// has to show whatever the address says.
test('blocks Reels and leaves Messages usable right after it', async ({
  newRealInstagramPage,
}, testInfo) => {
  const page = await newRealInstagramPage()
  await visit(page, '/')
  await assertSignedIn(page)

  await page.locator('a[href="/reels/"]').first().click()

  await expect(page.locator(REELS_PLAYER)).toBeAttached({ timeout: 30_000 })
  await expect(page.locator(REELS_PLAYER)).toBeHidden()
  await expect(page.locator(OVERLAY)).toContainText('Block Reels')
  await expect.poll(() => playingVideos(page)).toBe(0)
  await checkpoint(page, testInfo, '05-reels-blocked')

  await page.locator('a[href="/direct/inbox/"]').first().click()

  await expect(page.locator('[aria-label="Thread list"]')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.locator(OVERLAY)).toHaveCount(0)
  await checkpoint(page, testInfo, '06-messages-after-reels')

  await page.locator('a[href="/"]').nth(1).click()

  await expect(page.locator(ARTICLE).first()).toBeAttached({ timeout: 30_000 })
  await expect(page.locator(ARTICLE).first()).toBeHidden()
})

test('leaves a shared reel and a post untouched', async ({
  newRealInstagramPage,
}) => {
  const page = await newRealInstagramPage()
  await visit(page, '/reels/')
  await assertSignedIn(page)
  await expect
    .poll(() => page.url(), { timeout: 30_000 })
    .toMatch(/\/reels\/[^/]+\//)
  const reelId = new URL(page.url()).pathname.split('/')[2]

  await visit(page, '/explore/')
  const postHref = await page
    .locator('main[role="main"] a[href^="/p/"]')
    .first()
    .getAttribute('href', { timeout: 30_000 })

  for (const path of [`/reel/${reelId}/`, postHref ?? '']) {
    expect(path, 'a real post link from Explore').toMatch(/^\/(reel|p)\//)
    await visit(page, path)

    await expect(page.locator('main[role="main"]'), path).toBeVisible({
      timeout: 30_000,
    })
    expect(await blockedAttributes(page), path).toEqual([])
    await expect(page.locator(OVERLAY), path).toHaveCount(0)
  }
})
