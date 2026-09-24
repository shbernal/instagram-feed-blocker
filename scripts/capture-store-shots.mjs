// Writes the Chrome Web Store and AMO screenshot set from real Instagram, with
// the built extension loaded and the signed-in profile `pnpm e2e:real:setup`
// leaves behind. Four of the five shots are blocked pages, which hold nobody
// else's content by construction; the before-and-after shot is the one that has
// to blur a real feed, and the signed-in account is blurred on all of them.
//
// Nothing is copied into store/screenshots/ for you. These images go on two
// public listings and the blur is checked by eye, not by a test.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { printHelpAndExit } from './help.mjs'
import { resolveChromiumExecutable } from './browsers.mjs'

const defaultOutDir = 'media-capture/store'

printHelpAndExit(`
Usage: pnpm store:shots [--help]

Drives real Instagram in Chromium with dist/ loaded and writes the 1280x800
store screenshot set. Needs a dist/ build and the signed-in profile from
pnpm e2e:real:setup. Review every image before copying it into
store/screenshots/.

Environment
  STORE_SHOTS_DIR                 output directory (default: ${defaultOutDir})
  INSTAGRAM_REAL_PROFILE_DIR      signed-in profile
                                  (default: .e2e/instagram-real-profile)
  STORE_SHOTS_HEADED              1 to watch the run
  PLAYWRIGHT_CHROMIUM_EXECUTABLE  Chromium-family binary to launch

See docs/ci-release-flow.md.
`)

const WIDTH = 1280
const HEIGHT = 800

// Instagram renders client-side and keeps moving after load, so every shot is
// taken on a timer rather than on a network signal.
const SETTLE_MS = 5000

const root = process.cwd()
const outDir = path.resolve(root, process.env.STORE_SHOTS_DIR ?? defaultOutDir)
const profileDir = path.resolve(
  root,
  process.env.INSTAGRAM_REAL_PROFILE_DIR ?? '.e2e/instagram-real-profile',
)
const extensionPath = path.resolve(root, 'dist')

const SETTINGS_KEY = 'extensionSettings'

const sections = {
  homeFeed: false,
  homeStories: false,
  homeSuggestions: false,
  explore: false,
  reels: false,
}

const allBlocked = { active: true, overlay: true, ...mapSections(true) }
const nothingBlocked = { active: false, overlay: true, ...mapSections(false) }

function mapSections(value) {
  return Object.fromEntries(Object.keys(sections).map(key => [key, value]))
}

const log = (...args) => console.log('[store:shots]', ...args)

if (!fs.existsSync(extensionPath)) {
  throw new Error('dist/ is missing; run pnpm build first')
}

if (!fs.existsSync(profileDir)) {
  throw new Error(
    `${path.relative(root, profileDir)} is missing; run pnpm e2e:real:setup first`,
  )
}

fs.mkdirSync(outDir, { recursive: true })

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: resolveChromiumExecutable(),
  headless: process.env.STORE_SHOTS_HEADED !== '1',
  viewport: { width: WIDTH, height: HEIGHT },
  locale: 'en-US',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
  ],
})

const isExtensionWorker = worker =>
  worker.url().startsWith('chrome-extension://')

const worker =
  context.serviceWorkers().find(isExtensionWorker) ??
  (await context.waitForEvent('serviceworker', {
    predicate: isExtensionWorker,
  }))

const extensionId = new URL(worker.url()).hostname

// Callback form, not a promise: the same rule the extension itself follows, so
// this keeps working if it is ever pointed at a Gecko runtime.
const seedSettings = settings =>
  worker.evaluate(
    ({ key, value }) =>
      new Promise(resolve => {
        chrome.storage.local.set({ [key]: value }, () => resolve())
      }),
    { key: SETTINGS_KEY, value: settings },
  )

// The handle and the display name are the only personal thing a blocked page
// still shows, and Instagram gives neither a stable hook. Both sit in the block
// that also holds the "Switch" link, so that block is found by its two ends and
// blurred whole. Nothing here reads page content for any other purpose.
const blurIdentity = page =>
  page.evaluate(() => {
    const leaves = [
      ...document.querySelectorAll('span, a, div, h1, h2'),
    ].filter(element => element.childElementCount === 0)
    const alt =
      document
        .querySelector('img[alt*="profile picture" i]')
        ?.getAttribute('alt') ?? ''
    const handle = alt.replace(/['’]s profile picture.*$/i, '').trim()

    const blur = element => {
      if (element instanceof HTMLElement) {
        element.style.filter = 'blur(7px)'
      }
    }

    for (const image of document.querySelectorAll(
      'img[alt*="profile picture" i]',
    )) {
      blur(image)
    }

    const named = leaves.filter(
      element => handle !== '' && element.textContent.trim() === handle,
    )
    const switcher = leaves.find(
      element => element.textContent.trim() === 'Switch',
    )

    if (named.length > 0 && switcher) {
      const ancestors = new Set()
      for (let node = named[0]; node; node = node.parentElement) {
        ancestors.add(node)
      }
      for (let node = switcher; node; node = node.parentElement) {
        if (ancestors.has(node)) {
          blur(node)
          break
        }
      }
    }

    for (const element of named) {
      blur(element)
    }
  })

// The unblocked page is other people's posts, avatars and handles, and the
// suggestions rail is nothing but handles. Every image, every post and every
// link to somebody's profile goes; the nav's own routes are what is left
// readable. Blurred in the browser, so nothing legible is written to disk.
const NAV_ROUTES = new Set([
  '/',
  '/explore/',
  '/reels/',
  '/direct/inbox/',
  '/accounts/edit/',
])

const blurFeed = page =>
  page.evaluate(
    navRoutes => {
      const blur = element => {
        if (element instanceof HTMLElement) {
          element.style.filter = 'blur(14px)'
        }
      }

      for (const element of document.querySelectorAll(
        'article, [data-pagelet="story_tray"], img, video, canvas',
      )) {
        blur(element)
      }

      for (const anchor of document.querySelectorAll('a[href^="/"]')) {
        const { pathname } = new URL(anchor.href)

        if (!navRoutes.includes(pathname)) {
          blur(anchor)
        }
      }
    },
    [...NAV_ROUTES],
  )

const visit = async (page, route) => {
  await page.goto(`https://www.instagram.com${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
  await page.waitForTimeout(SETTLE_MS)
}

const shoot = async (page, name) => {
  await blurIdentity(page)

  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file })
  log(`wrote ${path.relative(root, file)}`)
  return fs.readFileSync(file)
}

// Lays out PNGs in a throwaway page and photographs it. Compositing in the
// browser rather than in pixels is what gives these real shadows, rounding and
// type without a second image library.
const compose = async (name, body, style) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: WIDTH, height: HEIGHT })
  await page.setContent(`
    <style>
      html, body {
        margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
      }
      body {
        position: relative;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      ${style}
    </style>
    ${body}
  `)
  await page.waitForTimeout(500)

  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file })
  await page.close()
  log(`wrote ${path.relative(root, file)}`)
}

const dataUri = buffer => `data:image/png;base64,${buffer.toString('base64')}`

try {
  const page = context.pages()[0] ?? (await context.newPage())

  await seedSettings(nothingBlocked)
  await visit(page, '/')
  await blurFeed(page)
  await blurIdentity(page)
  const homeOpen = await page.screenshot()

  await seedSettings(allBlocked)
  await visit(page, '/')
  const homeBlocked = await shoot(page, 'instagram-feedblocker-2-home-blocked')

  await visit(page, '/explore/')
  await shoot(page, 'instagram-feedblocker-4-explore-blocked')

  await visit(page, '/reels/')
  await shoot(page, 'instagram-feedblocker-5-reels-blocked')

  // The popup is 340px of browser chrome that no page screenshot can contain,
  // so it is photographed on its own and laid over the blocked Home shot.
  const popupPage = await context.newPage()
  await popupPage.setViewportSize({ width: 340, height: 600 })
  await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`)
  await popupPage.waitForSelector('input[type=checkbox]', { state: 'attached' })
  await popupPage.waitForTimeout(500)
  const popupHeight = await popupPage.evaluate(() => document.body.scrollHeight)
  const popup = await popupPage.screenshot({
    clip: { x: 0, y: 0, width: 340, height: popupHeight },
  })
  await popupPage.close()

  await compose(
    'instagram-feedblocker-1-before-after',
    `
      <h1>The same Home page, before and after</h1>
      <div class="row">
        <div class="pane">
          <p class="label">Instagram as it ships</p>
          <img src="${dataUri(homeOpen)}">
        </div>
        <div class="pane">
          <p class="label">With the feed blocked</p>
          <img src="${dataUri(homeBlocked)}">
        </div>
      </div>
      <p class="foot">Messages, search, profiles and linked posts are untouched.</p>
    `,
    `
      body {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 30px; background: #f5f5f5;
        padding: 0 36px; box-sizing: border-box; color: #262626;
      }
      h1 {
        margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.02em;
      }
      .row { display: flex; gap: 28px; }
      .pane { width: 574px; }
      .label {
        margin: 0 0 12px; font-size: 18px; font-weight: 600;
        text-align: center; letter-spacing: -0.01em;
      }
      .pane img {
        width: 574px; display: block; border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
      }
      .foot { margin: 0; font-size: 17px; color: #737373; }
    `,
  )

  await compose(
    'instagram-feedblocker-3-popup-controls',
    `
      <img class="page" src="${dataUri(homeBlocked)}">
      <img class="popup" src="${dataUri(popup)}">
    `,
    `
      img.page { width: ${WIDTH}px; height: ${HEIGHT}px; display: block; }
      img.popup {
        position: absolute; top: 26px; right: 40px; width: 340px;
        border-radius: 12px; box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
      }
    `,
  )
} finally {
  await context.close()
}

log(
  `review ${path.relative(root, outDir)} before copying into store/screenshots/`,
)
