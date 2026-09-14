// Opens the signed-in real-site profile in a headed Chromium and leaves it open,
// for checking the session or looking at Instagram by hand with or without the
// built extension.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { printHelpAndExit } from './help.mjs'
import { resolveChromiumExecutable } from './browsers.mjs'

const defaultProfilePath = '.e2e/instagram-real-profile'
const defaultOpenUrl = 'https://www.instagram.com/'

printHelpAndExit(`
Usage: pnpm e2e:real:open [--help]
       pnpm e2e:real:open:extension [--help]

Opens a headed Chromium on the persistent profile that pnpm e2e:real:setup
signs in, prints whether the session is signed in as JSON, then stays open until
the window is closed.

Environment
  INSTAGRAM_REAL_PROFILE_DIR      profile directory, relative to the repo root
                                  (default: ${defaultProfilePath})
  INSTAGRAM_REAL_OPEN_URL         URL to open (default: ${defaultOpenUrl})
  INSTAGRAM_REAL_OPEN_EXTENSION   set to 1 to load dist/; the :extension script
                                  sets it after building
  PLAYWRIGHT_CHROMIUM_EXECUTABLE  Chromium-family binary to launch

See docs/testing.md.
`)

// Imported after the help check rather than at the top, so `--help` answers
// without paying for Playwright's module graph.
const { chromium } = await import('@playwright/test')

const extensionPath = path.resolve(process.cwd(), 'dist')
const profilePath = path.resolve(
  process.cwd(),
  process.env.INSTAGRAM_REAL_PROFILE_DIR ?? defaultProfilePath,
)
const openUrl = process.env.INSTAGRAM_REAL_OPEN_URL ?? defaultOpenUrl
const loadExtension = process.env.INSTAGRAM_REAL_OPEN_EXTENSION === '1'

if (
  loadExtension &&
  !fs.existsSync(path.join(extensionPath, 'manifest.json'))
) {
  throw new Error(
    `Missing built extension at ${extensionPath}. Run pnpm build first.`,
  )
}

const executablePath = resolveChromiumExecutable()
const context = await chromium.launchPersistentContext(profilePath, {
  ...(executablePath ? { executablePath } : { channel: 'chromium' }),
  headless: false,
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
  args: loadExtension
    ? [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ]
    : [],
})

const page = context.pages()[0] ?? (await context.newPage())
await page.goto(openUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(5_000)

const hasSession = (await context.cookies(defaultOpenUrl)).some(
  cookie => cookie.name === 'sessionid' && cookie.value,
)

console.log(
  JSON.stringify(
    {
      url: page.url(),
      profile: path.relative(process.cwd(), profilePath),
      extensionLoaded: loadExtension,
      signedIn:
        hasSession && !new URL(page.url()).pathname.startsWith('/accounts/'),
    },
    null,
    2,
  ),
)
console.log('Chromium is open. Close the window to end this command.')

await context.waitForEvent('close', { timeout: 0 })
