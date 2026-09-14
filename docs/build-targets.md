# Build targets

One source tree builds two packages. `EXT_TARGET` picks the target, and both
`vite.config.ts` and `manifest.config.ts` read it.

| Target   | Command              | `EXT_TARGET` | Output          |
| -------- | -------------------- | ------------ | --------------- |
| Chromium | `pnpm build`         | unset        | `dist/`         |
| Firefox  | `pnpm build:firefox` | `firefox`    | `dist-firefox/` |

Any value other than `firefox` builds the Chromium package.

## What differs

Only the manifest. The JavaScript, CSS, HTML and icons are the same in both
packages, and `tests/manifest-targets.test.ts` fails if any manifest key other
than these two differs.

- The background entry. Chromium gets `background.service_worker`. Firefox has
  no extension service workers and gets `background.scripts`. crxjs reads this
  entry from the manifest config as written, so the condition lives there.
- `browser_specific_settings.gecko`, Firefox only. It carries the add-on id
  `instagram-feed-blocker@shbernal.github.io`, `strict_min_version` 140, and a
  declaration that the extension collects no data. Firefox ignores
  `data_collection_permissions` before version 140, which is what sets the
  floor.

Treat the add-on id as permanent from the first upload to addons.mozilla.org. A
new id makes a new add-on and strands everyone on the old one.

## Firefox lint

`pnpm lint:firefox` builds the Firefox package and runs `web-ext lint` on it,
which catches manifest keys Firefox rejects, malformed ids and reserved
shortcuts. The bar is zero errors, and three warnings are expected:

- `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` for
  `data_collection_permissions`, which Firefox for Android supports from a
  later version than desktop Firefox;
- two `UNSAFE_VAR_ASSIGNMENT` warnings for `innerHTML` in the popup chunk,
  which come from React's own bundle.

A new warning pointing at the extension's own code is a regression. The in-page
card is built without `innerHTML` for exactly this reason.

The toggle command's `Ctrl+Shift+9` passes the reserved-shortcut check.

## Firefox at runtime

No automated test runs the Firefox package, because Playwright cannot load an
MV3 extension into Firefox. `pnpm dev:firefox` and `pnpm dev:zen` install
`dist-firefox/` as a temporary add-on on a throwaway profile, and
`FIREFOX_BINARY` picks another Gecko browser. The manual checklist in
[Testing](./testing.md) is what covers this target today.
