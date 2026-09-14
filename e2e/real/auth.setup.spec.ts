import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import {
  closeBrowserContext,
  launchBrowserProfileContext,
} from '../fixtures/extensionRuntime'
import { INSTAGRAM_URL, isSignedIn } from '../fixtures/instagramSession'
import {
  resolveRealInstagramProfilePath,
  resolveRealInstagramStatePath,
  resolveVerificationCodePath,
} from '../fixtures/realProfile'

// This run types a password. Traces record typed text, so nothing records.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const POLL_MS = 2_000
const SIGN_IN_TIMEOUT_MS = 15 * 60_000

const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

const relative = (target: string) => path.relative(process.cwd(), target)

const usernameInput = (page: Page) =>
  page.locator('input[name="username"], input[name="email"]').first()

const passwordInput = (page: Page) =>
  page.locator('input[name="password"], input[name="pass"]').first()

const codeInput = (page: Page) =>
  page
    .locator(
      [
        'input[name="verificationCode"]',
        'input[name="security_code"]',
        'input[name="approvals_code"]',
        'input[autocomplete="one-time-code"]',
      ].join(', '),
    )
    .first()

const isVisible = async (locator: ReturnType<Page['locator']>) => {
  return locator.isVisible().catch(() => false)
}

// A dialog button can be visible yet never actionable, for instance under an
// animation or another overlay. Give up quickly rather than wait forever: the
// polling loop comes back to it.
const clickButton = async (page: Page, name: RegExp) => {
  const button = page.getByRole('button', { name }).first()
  if (!(await isVisible(button))) {
    return false
  }

  try {
    await button.click({ timeout: 5_000 })
    console.log(`Clicked ${name.source}`)
    return true
  } catch {
    console.log(`Could not click ${name.source}`)
    return false
  }
}

// Only taken while no login form is on screen, so a typed address never lands
// in an image.
const snapshotState = async (page: Page, label: string) => {
  if (await isVisible(usernameInput(page))) {
    return
  }

  const target = path.resolve(
    process.cwd(),
    `.e2e/instagram-login-${label}.png`,
  )
  await page.screenshot({ path: target }).catch(() => undefined)
  console.log(`State screenshot: ${relative(target)}`)
}

// Order matters: saving the login is what keeps the profile signed in across
// runs, so it is answered before any "Not now" can decline it.
const answerInterstitials = async (page: Page) => {
  await clickButton(page, /^(allow all cookies|accept all cookies)$/i)
  await clickButton(page, /^this was me$/i)
  if (!(await clickButton(page, /^save( login)? info$/i))) {
    await clickButton(page, /^not now$/i)
  }
}

const loginErrorText =
  /password was incorrect|couldn't find your account|please wait a few minutes|we suspended your account/i

const submitCredentials = async (page: Page) => {
  const email = process.env.INSTAGRAM_EMAIL
  const password = process.env.INSTAGRAM_PASSWORD

  if (!email || !password) {
    console.log(
      'INSTAGRAM_EMAIL or INSTAGRAM_PASSWORD is not set. Sign in by hand in ' +
        'the Chromium window.',
    )
    return
  }

  if (!(await isVisible(usernameInput(page)))) {
    await page.goto(`${INSTAGRAM_URL}accounts/login/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
  }

  await usernameInput(page).waitFor({ timeout: 30_000 })
  await answerInterstitials(page)

  await usernameInput(page).click()
  await usernameInput(page).pressSequentially(email, { delay: 70 })
  await passwordInput(page).click()
  await passwordInput(page).pressSequentially(password, { delay: 70 })
  await passwordInput(page).press('Enter')

  console.log('Submitted the login form.')
}

// A single attempt, then a patient wait. Resubmitting on failure is exactly
// what gets a login flagged, so an error ends the run instead.
const waitUntilSignedIn = async (page: Page) => {
  const codePath = resolveVerificationCodePath()
  const deadline = Date.now() + SIGN_IN_TIMEOUT_MS
  let lastPath = ''
  let announcedCode = false

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new Error('The window closed before sign-in finished.')
    }

    if (await isSignedIn(page)) {
      return
    }

    const currentPath = new URL(page.url()).pathname
    if (currentPath !== lastPath) {
      console.log(`Now at ${currentPath}`)
      lastPath = currentPath
      await snapshotState(page, currentPath.replace(/\W+/g, '-') || 'root')
    }

    const error = page.getByText(loginErrorText).first()
    if (await isVisible(error)) {
      throw new Error(`Instagram refused the login: ${await error.innerText()}`)
    }

    await answerInterstitials(page)

    const code = codeInput(page)
    if (await isVisible(code)) {
      if (!announcedCode) {
        console.log(
          `Verification code required at ${currentPath}. Type it into the ` +
            `window, or write it to ${relative(codePath)}.`,
        )
        announcedCode = true
      }

      if (fs.existsSync(codePath)) {
        const value = fs.readFileSync(codePath, 'utf8').trim()
        fs.rmSync(codePath)
        await code.fill(value)
        await code.press('Enter')
        console.log('Submitted the verification code.')
        announcedCode = false
      }
    }

    await page.waitForTimeout(POLL_MS)
  }

  throw new Error('Timed out waiting for Instagram sign-in.')
}

test('authenticate persistent Instagram profile @setup', async ({
  headless,
}) => {
  test.setTimeout(0)

  const profilePath = resolveRealInstagramProfilePath()
  const statePath = resolveRealInstagramStatePath()
  const context = await launchBrowserProfileContext({
    userDataDir: profilePath,
    headless,
    loadExtension: false,
  })

  // The test itself has no timeout, so without this an action on a context
  // launched by hand waits forever.
  context.setDefaultTimeout(30_000)

  try {
    const page = context.pages()[0] ?? (await context.newPage())
    console.log('Opening Instagram.')
    await page.goto(INSTAGRAM_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.waitForTimeout(3_000)
    console.log(`Loaded ${new URL(page.url()).pathname}`)
    await snapshotState(page, 'landing')
    await answerInterstitials(page)

    if (await isSignedIn(page)) {
      console.log('Profile is already signed in.')
    } else {
      await submitCredentials(page)
      await waitUntilSignedIn(page)
      console.log('Signed in.')

      await page.goto(INSTAGRAM_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      await page.waitForTimeout(3_000)
      await answerInterstitials(page)
    }

    await context.storageState({ path: statePath })
    console.log(
      `Profile: ${relative(profilePath)}\nStorage state: ${relative(statePath)}`,
    )
  } finally {
    await closeBrowserContext(context)
  }
})
