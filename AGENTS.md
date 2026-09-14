# AI project guidelines

`instagram-feed-blocker`: a Manifest V3 browser extension, built for Chromium
and Gecko from one source tree, that hides Instagram's algorithmic surfaces
while keeping messages, search, and profiles usable.

- Key commands
  - `pnpm build` (Chromium, `dist/`) and `pnpm build:firefox` (`dist-firefox/`)
  - `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`
  - `pnpm lint:firefox` when touching the manifest or packaging

- Rules with consequences
  - Never `await` a `chrome.*` call: Gecko's `chrome.*` is callback-only.
    `tests/browser-api-compat.test.ts` enforces it.
  - Only the background entry and `browser_specific_settings` may differ
    between build targets. `tests/manifest-targets.test.ts` enforces it.
  - No two manifest entries may share a basename.
    `tests/manifest-entry-names.test.ts` enforces it.

- Iron Laws
  - Tokens are expensive, state of the art models need minimal guidance, don't repeat yourself, don't babysit, don't be over-specific.
  - AI-native project. All code is AI-generated.
  - Minimal attention when model implements without errors, we document in more detail when model struggles.
  - Do not expect the user to have read each line, don't lose him on the internals, give visibility on a higher-architectural level.
  - No journaling: code comments / documentation describe current state, they don't carry a log of their own edit history.
