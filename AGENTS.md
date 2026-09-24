# AI project guidelines

`instagram-feed-blocker`: a Manifest V3 browser extension that hides Instagram's
feed, stories, suggestions, Explore grid and Reels, and leaves messages, search,
profiles and linked posts alone. One source tree builds for Chromium and
Firefox.

- Key commands
  - The full gate, for any change to `src/`, `e2e/`, the manifest or config:
    `pnpm format && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm e2e && pnpm lint:firefox`
  - `pnpm e2e:real` after changing a selector or a fixture, with a session from
    `pnpm e2e:real:setup`
  - `UPDATE_BLOCKING_CSS=1 pnpm test` after changing `SECTION_SELECTORS`
  - `pnpm icons` after changing `store/logo.svg`, judged at 16px

- Key documentation
  - [docs/current-implementation.md](docs/current-implementation.md): routes,
    selectors, the curtain, media and the card
  - [docs/testing.md](docs/testing.md): the test layers, the fixture rule, the
    real-site lane
  - [docs/build-targets.md](docs/build-targets.md): the Firefox build
  - [docs/icon-explorations.md](docs/icon-explorations.md): read before
    proposing a new mark

- Rules with consequences
  - Never `await` a `chrome.*` call. Firefox's `chrome.*` is callback-only.
    `tests/browser-api-compat.test.ts` enforces it.
  - Only the background entry and `browser_specific_settings` may differ
    between build targets. `tests/manifest-targets.test.ts` enforces it.
  - No two manifest entries may share a basename.
    `tests/manifest-entry-names.test.ts` enforces it.
  - `src/content/blocking.css` is generated. `tests/blocking-css.test.ts`
    enforces it.
  - Fixture markup is copied from live Instagram, never written to fit a
    selector.
  - No selector names a class. Instagram regenerates them with every build.
  - Reels hiding, media and the card key on what is mounted in the page, never
    on the address. Instagram can leave `/reels/<id>/` in the address bar over
    Messages.
  - `.e2e/` holds a live Instagram session and `.env` holds its credentials.
    Neither is ever committed.
  - The coverage floor in `vitest.config.ts` only moves up.
  - The mark never uses Instagram's camera glyph. It does wear their gradient,
    a deliberate call with store rejection as its known cost.
    `store/logo-dusk.svg` is the standby that borrows nothing; switching is one
    edit to `MARK` in `scripts/generate-icons.mjs` plus `pnpm icons`.
  - Do not publish, tag releases or upload packages unless asked.

- Iron Laws
  - Tokens are expensive, state of the art models need minimal guidance, don't repeat yourself, don't babysit, don't be over-specific.
  - AI-native project. All code is AI-generated.
  - Minimal attention when model implements without errors, we document in more detail when model struggles.
  - Do not expect the user to have read each line, don't lose him on the internals, give visibility on a higher-architectural level.
  - No journaling: code comments / documentation describe current state, they don't carry a log of their own edit history.
