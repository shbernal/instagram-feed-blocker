import type { BrowserContext, Route } from '@playwright/test'
import {
  DIRECT_BODY,
  EXPLORE_BODY,
  EXPLORE_SEARCH_BODY,
  HOME_BODY,
  HOME_NARROW_BODY,
  POST_BODY,
  PROFILE_BODY,
  REEL_BODY,
  REELS_BODY,
} from '../../src/test/fixtures/instagram'

declare global {
  interface Window {
    __igfbParseTime?: Record<string, string | null>
  }
}

/**
 * The body Instagram serves for a path. Variants of the same route are picked
 * with a `fixture` query parameter rather than a different path, so route
 * gating still sees the path the real page would have.
 */
export const getFixtureBody = (url: URL) => {
  const { pathname } = url
  const variant = url.searchParams.get('fixture')

  if (pathname === '/') {
    return variant === 'narrow' ? HOME_NARROW_BODY : HOME_BODY
  }

  if (pathname === '/explore/' || pathname === '/explore') {
    return variant === 'search' ? EXPLORE_SEARCH_BODY : EXPLORE_BODY
  }

  if (pathname.startsWith('/reels/')) {
    return REELS_BODY
  }

  if (pathname.startsWith('/reel/')) {
    return REEL_BODY
  }

  if (pathname.startsWith('/p/')) {
    return POST_BODY
  }

  if (pathname.startsWith('/direct/')) {
    return DIRECT_BODY
  }

  // The story viewer opens over Home, which stays in the DOM underneath.
  if (pathname.startsWith('/stories/')) {
    return HOME_BODY
  }

  return PROFILE_BODY
}

// Records what the page looks like while the document is still parsing. Test
// machinery, not page markup: nothing in `src/` sees it. It also records
// whether the content script had already marked the page ready by then,
// because a curtain observed after the gate cleared proves nothing.
const PARSE_TIME_PROBE = `<script>
  window.__igfbParseTime = Object.fromEntries([
    ['ready', String(document.documentElement.hasAttribute('data-igfb-ready'))],
    ...['main[role="main"] article', '[data-pagelet="story_tray"]'].map(selector => {
      const element = document.querySelector(selector)
      return [selector, element ? getComputedStyle(element).visibility : null]
    }),
  ])
</script>`

// The fixture markup is pruned and unstyled, so most of it lays out with no size
// at all, and Playwright counts an element with an empty box as hidden. That
// made "hidden" assertions pass whether or not the extension hid anything. This
// gives every element the specs look at a box of its own. Test machinery, not
// page markup; the extension's `display: none !important` still wins over it.
const FIXTURE_LAYOUT = `<style>
  main[role="main"] article,
  [data-pagelet="story_tray"],
  [aria-label="Thread list"],
  [role="button"],
  a[href] {
    display: block;
    min-width: 24px;
    min-height: 24px;
  }
</style>`

export const renderFixturePage = (url: URL) => {
  const probe = url.searchParams.get('probe') === 'parse-time'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Instagram</title>
    ${FIXTURE_LAYOUT}
  </head>
  <body>
${getFixtureBody(url)}
${probe ? PARSE_TIME_PROBE : ''}
  </body>
</html>`
}

// Serving the fixtures from real Instagram URLs is the point: the content
// script still sees `https://www.instagram.com/...`, so the manifest match and
// the route table are exercised without an account or a network.
const fulfillInstagramRoute = async (route: Route) => {
  const url = new URL(route.request().url())

  if (route.request().resourceType() !== 'document') {
    await route.fulfill({ status: 204, body: '' })
    return
  }

  await route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: renderFixturePage(url),
  })
}

export const installInstagramFixtureRoutes = async (
  context: BrowserContext,
) => {
  await context.route('https://www.instagram.com/**', fulfillInstagramRoute)
}
