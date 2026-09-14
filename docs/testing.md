# Testing

Three layers, fastest first. Use the smallest one that proves the claim.

1. Vitest, in `src/**/*.test.ts(x)` and `tests/`. jsdom tests for the settings
   contract, routes, selectors against fixture markup, the generated
   stylesheet, media, the card, the content script, the background worker, the
   popup, and the source-tree guards.
2. Fixture Playwright, in `e2e/specs/`. The built extension in a real Chromium
   against Instagram-shaped pages served from real `instagram.com` addresses. No
   account and no network.
3. Real-site Playwright, in `e2e/real/` and `e2e/manual/`. The built extension
   in a signed-in profile on live Instagram. Opt-in and headed. It is the only
   layer that notices Instagram changing its markup.

Firefox has no runtime layer, because Playwright cannot load an MV3 extension
into Firefox. [Build targets](./build-targets.md) covers what is checked there.

## Commands

- `pnpm test` runs Vitest once, and `pnpm test:watch` keeps it running.
- `pnpm test:coverage` adds coverage and fails below the floor in
  `vitest.config.ts`.
- `pnpm e2e` builds and runs the fixture suite. `pnpm e2e:headed` and
  `pnpm e2e:ui` are the headed and UI forms.
- `pnpm e2e:real:setup` signs the persistent profile in to Instagram.
- `pnpm e2e:real` builds and runs the real-site lane.
- `pnpm e2e:real:open` opens the profile for a look, and
  `pnpm e2e:real:open:extension` does the same with `dist/` loaded.
- `pnpm manual:instagram` opens the profile with `dist/` loaded and no timeout.
- `pnpm dev:chrome [url]` opens `dist/` in Chromium on a throwaway profile.
  `pnpm dev:firefox [url]` and `pnpm dev:zen [url]` install `dist-firefox/` as
  a temporary add-on.
- `pnpm inspect:chrome [url]` prints a JSON snapshot of the running extension,
  with its permissions, command binding, storage, popup controls and the
  `data-igfb-*` attributes on the page.
  `INSPECT_PROFILE_DIR=.e2e/instagram-real-profile` runs it against the
  signed-in profile.

## Vitest

- The environment is jsdom, with `https://www.instagram.com/` as its address.
  jsdom supports `:has()` in `querySelectorAll` and in the cascade, so selector
  tests can apply the generated stylesheet and read computed styles.
- `src/test/setup.ts` installs a fresh Chrome API mock and media stub before
  each test. Afterwards it clears the section attributes, the ready gate and
  the card's stylesheet, which live on `<html>` and survive a body reset.
- `src/test/chrome.ts` mocks storage and its change event, runtime messages,
  commands and tabs, all in callback form. `set` and `remove` fire change events
  the way Chrome does.
- `src/test/media.ts` gives media elements working `play`, `pause` and
  `paused`. jsdom has no playback of its own.
- Content-script tests import a fresh module per test and call
  `initContentScript` themselves. The module never starts itself under test.

## Fixtures

`src/test/fixtures/instagram.ts` holds the markup both deterministic layers use:
Home at wide and narrow widths, Explore with and without search in use, Reels, a
post, a shared reel, a profile, and Messages.

The markup was copied from live desktop Instagram and pruned to the elements the
selectors walk, plus the neighbours that must stay visible. Tags, attributes and
nesting depth are Instagram's. Text, usernames, post ids and media addresses are
placeholders.

Never edit a fixture until a selector passes. A fixture written to fit a
selector gives a green suite that matches nothing on the real site. When a
selector changes, capture the element again from a live page and prune it the
same way.

## Fixture Playwright

`e2e/fixtures/instagramPages.ts` answers `https://www.instagram.com/**` with
fixture pages chosen by pathname, so the manifest match and the route table run
the way they do on the site. The `fixture` query parameter picks a variant of a
route without changing the path the route table sees: `?fixture=narrow` for
Home and `?fixture=search` for Explore.

Two bits of test machinery live in that file.

- A small stylesheet gives articles, links, the stories tray, buttons and the
  thread list a box. Pruned markup has no layout, and Playwright counts an
  element with an empty box as hidden, so "hidden" assertions used to pass
  whether or not the extension hid anything. The extension's
  `display: none !important` still wins over it.
- `?probe=parse-time` adds an inline script that records, while the document is
  still parsing, whether the page was already marked ready and the computed
  visibility of the feed and the stories tray.

The suite has been run against deliberately broken builds. With `blocking.css`
emptied, the 11 specs that claim something is hidden failed and the other 8
passed. With the Reels rule keyed on `main` alone, only the stale-address spec
failed.

Each test launches its own persistent Chromium, which is why the per-test
timeout is 60 seconds.

## Source guards

`tests/` checks the source tree rather than behaviour.

- `browser-api-compat.test.ts` fails on any awaited `chrome.*` call under
  `src/`.
- `manifest-targets.test.ts` fails if the Chromium and Firefox manifests differ
  anywhere but the background entry and `browser_specific_settings`, or if the
  manifest's suggested shortcut disagrees with `DEFAULT_TOGGLE_SHORTCUT`.
- `manifest-entry-names.test.ts` fails if two manifest entries share a basename.
- `popup-native-dialogs.test.ts` fails if the popup declares a colour or file
  input. Their native dialogs close a Firefox popup mid-interaction.
- `blocking-css.test.ts` fails if `src/content/blocking.css` differs from its
  generator.

## Coverage

`vitest.config.ts` sets a floor a couple of points under the measured numbers.
Raise it when coverage rises, and never lower it to make a change fit. The known
uncovered lines are the content script's self-start and hot-reload hooks, which
do not run under test, and the error path of a refused `play()` on restore.

## Real-site lane

### Signing in

`pnpm e2e:real:setup` opens a persistent Chromium profile at
`.e2e/instagram-real-profile` and signs it in with `INSTAGRAM_EMAIL` and
`INSTAGRAM_PASSWORD` from `.env`, using a test account. Tracing, screenshots and
video are off for that run, because a trace records typed text. If Instagram
asks for a verification code, type it into the window or write it to
`.e2e/instagram-verification-code`, which the run watches. A refused login ends
the run instead of retrying, since repeated attempts get a login flagged.

Later runs find the session and only export it to
`.e2e/instagram-storage-state.json`. `INSTAGRAM_REAL_PROFILE_DIR` points the
lane at a different profile.

Everything under `.e2e/` is a live session, and git ignores it. Never commit it,
and never paste a cookie value anywhere.

### Running it

`pnpm e2e:real` loads `dist/` into the profile and checks, on live Instagram,
that:

- Home is blocked, the card unblocks it and the Block button blocks it again;
- the Explore grid is hidden while search works and no grid video plays;
- Reels hides its player with nothing playing, and Messages is usable right
  after leaving Reels, whatever the address says;
- a shared reel and a post from Explore are left alone.

Each test puts the default settings back when it finishes. Checkpoint
screenshots go to `test-results/`.

Keep the traffic modest. Run it once at a time and avoid reload loops, which is
how a test account gets flagged.

## Manual checklist

After a build, with `pnpm dev:chrome` or `pnpm manual:instagram`, check that:

- popup switches survive closing and reopening the popup;
- Home, Explore and Reels each block and restore from the popup, from the card
  and from `Ctrl+Shift+9`;
- Messages, a profile and a linked post are untouched with everything blocked;
- a Home or Explore video stops once its section is blocked;
- the card is readable and out of the way at full width and in a narrow window.

Repeat it in Firefox with `pnpm dev:firefox`. Nothing automated covers the
Firefox background script or popup.
