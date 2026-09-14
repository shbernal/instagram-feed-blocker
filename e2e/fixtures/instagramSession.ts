import type { BrowserContext, Page } from '@playwright/test'

export const INSTAGRAM_URL = 'https://www.instagram.com/'

// Instagram serves its login form on `/` itself when signed out, so the path
// alone cannot prove a session. These are the places a session is certainly
// not usable yet.
const UNUSABLE_SESSION_PATH =
  /^\/(accounts\/login|accounts\/suspended|challenge|two_factor|auth_platform)/

export const hasSessionCookie = async (context: BrowserContext) => {
  const cookies = await context.cookies(INSTAGRAM_URL)
  return cookies.some(cookie => cookie.name === 'sessionid' && cookie.value)
}

export const isSignedIn = async (page: Page) => {
  if (UNUSABLE_SESSION_PATH.test(new URL(page.url()).pathname)) {
    return false
  }

  return hasSessionCookie(page.context())
}

export const assertSignedIn = async (page: Page) => {
  if (!(await isSignedIn(page))) {
    throw new Error(
      `Not signed in to Instagram at ${page.url()}. Run pnpm e2e:real:setup.`,
    )
  }
}
