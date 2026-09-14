import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/extension'
import { EVERYTHING_BLOCKED, NOTHING_BLOCKED, only } from '../fixtures/settings'
import { expectUncovered } from '../fixtures/visibility'
import { BLOCKED_SECTION_ATTRS } from '../../src/content/selectors'
import { DIRECT_BODY, REELS_BODY } from '../../src/test/fixtures/instagram'

const INSTAGRAM = 'https://www.instagram.com'

const ARTICLE = 'main[role="main"] article'
const STORY_TRAY = '[data-pagelet="story_tray"]'
const SEE_ALL = 'a[href="/explore/people/"]'
const SEARCH = 'input[aria-label="Search input"]'
const THREAD_LIST = '[aria-label="Thread list"]'

const blockedAttributes = (page: Page) => {
  return page.evaluate(attributes => {
    return Object.values(attributes).filter(attribute =>
      document.documentElement.hasAttribute(attribute),
    )
  }, BLOCKED_SECTION_ATTRS)
}

// Instagram pushes the route and then renders the new page into the same
// document. This does the same with fixture markup.
const navigateClientSide = async (page: Page, path: string, body: string) => {
  await page.evaluate(
    ({ path, body }) => {
      window.history.pushState({}, '', path)
      document.body.innerHTML = body
    },
    { path, body },
  )
}

test('blocks each Home section on its own and restores it', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(only('homeFeed'))

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/`)

  await expect(page.locator(ARTICLE).first()).toBeHidden()
  await expect(page.locator(STORY_TRAY)).toBeVisible()
  await expect(page.locator(SEE_ALL)).toBeVisible()

  await seedSettings(only('homeStories'))

  await expect(page.locator(ARTICLE).first()).toBeVisible()
  await expect(page.locator(STORY_TRAY)).toBeHidden()

  await seedSettings(only('homeSuggestions'))

  await expect(page.locator(STORY_TRAY)).toBeVisible()
  await expect(page.locator(SEE_ALL)).toBeHidden()
  await expect(page.getByText('Switch', { exact: true })).toBeVisible()

  await seedSettings(NOTHING_BLOCKED)

  await expect(page.locator(SEE_ALL)).toBeVisible()
  expect(await blockedAttributes(page)).toEqual([])
})

test('blocks the narrow Home layout and leaves its search box usable', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(EVERYTHING_BLOCKED)

  const page = await newInstagramPage()
  await page.setViewportSize({ width: 760, height: 900 })
  await page.goto(`${INSTAGRAM}/?fixture=narrow`)

  await expect(page.locator(ARTICLE).first()).toBeHidden()
  await expect(page.locator(STORY_TRAY)).toBeHidden()
  await expectUncovered(page.locator(SEARCH), 'the header search box')
})

test('hides the Explore grid and keeps search usable', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(only('explore'))

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/explore/`)

  await expect(
    page.locator('main[role="main"] a[href^="/p/"]').first(),
  ).toBeHidden()
  await expectUncovered(page.locator(SEARCH), 'the Explore search box')

  await page.goto(`${INSTAGRAM}/explore/?fixture=search`)

  await expect(page.locator('main[role="main"] a[href]').first()).toBeVisible()
  await expectUncovered(page.locator(SEARCH), 'the search box while searching')
})

test('hides the Reels player but not the navigation', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(only('reels'))

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/reels/abc/`)

  await expect(page.locator('main[role="main"]')).toBeHidden()
  await expect(page.locator('a[href="/direct/inbox/"]').first()).toBeVisible()
})

test('leaves intentional pages untouched with every section on', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(EVERYTHING_BLOCKED)

  const page = await newInstagramPage()

  for (const path of [
    '/direct/inbox/',
    '/p/abc/',
    '/reel/abc/',
    '/some.user/',
  ]) {
    await page.goto(`${INSTAGRAM}${path}`)

    await expect(page.locator('html')).toHaveAttribute(
      'data-igfb-ready',
      'true',
    )
    expect(await blockedAttributes(page), path).toEqual([])
    await expect(page.locator('main[role="main"]'), path).toBeVisible()
  }

  await page.goto(`${INSTAGRAM}/direct/inbox/`)
  await expectUncovered(page.locator(THREAD_LIST), 'the Messages thread list')
})

test('follows client-side navigation in both directions', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(EVERYTHING_BLOCKED)

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/`)
  await expect(page.locator(ARTICLE).first()).toBeHidden()

  await navigateClientSide(page, '/reels/abc/', REELS_BODY)

  await expect(page.locator('main[role="main"]')).toBeHidden()
  await expect
    .poll(() => blockedAttributes(page))
    .toEqual([BLOCKED_SECTION_ATTRS.reels])

  await navigateClientSide(page, '/direct/inbox/', DIRECT_BODY)

  await expect.poll(() => blockedAttributes(page)).toEqual([])
  await expectUncovered(page.locator(THREAD_LIST), 'the Messages thread list')
})

// Leaving Reels shortly after opening it, Instagram renders Messages and then
// rewrites the URL back to `/reels/<id>/`. The Reels section stays applied, and
// the inbox must not care.
test('keeps Messages usable under a stale Reels URL', async ({
  clearSettings,
  seedSettings,
  newInstagramPage,
}) => {
  await clearSettings()
  await seedSettings(EVERYTHING_BLOCKED)

  const page = await newInstagramPage()
  await page.goto(`${INSTAGRAM}/reels/abc/`)
  await expect(page.locator('main[role="main"]')).toBeHidden()

  await page.evaluate(body => {
    window.history.pushState({}, '', '/direct/inbox/')
    document.body.innerHTML = body
    window.history.replaceState({}, '', '/reels/def/')
  }, DIRECT_BODY)

  await expect(page.locator('html')).toHaveAttribute(
    BLOCKED_SECTION_ATTRS.reels,
    '',
  )
  await expectUncovered(page.locator(THREAD_LIST), 'the Messages thread list')
  await expect(page.locator('#igfb-overlay')).toHaveCount(0)
})
