# Project overview

Instagram Feed Blocker hides the parts of desktop Instagram that exist to keep
you scrolling and leaves alone the parts you open on purpose.

## What it blocks and what it keeps

| Section     | Route       | Hidden                                                         | Silenced      |
| ----------- | ----------- | -------------------------------------------------------------- | ------------- |
| Home feed   | `/`         | posts, suggested posts and ads, the For you and Following tabs | feed videos   |
| Stories     | `/`         | the stories tray                                               | nothing       |
| Suggestions | `/`         | the Suggested for you block in the right rail                  | nothing       |
| Explore     | `/explore/` | the grid and its tabs                                          | grid previews |
| Reels       | `/reels/`   | the Reels tab player                                           | the player    |

Each section has its own switch, and all of them start on.

The extension never touches Messages, search, notifications, profiles, a post
or reel opened from a link, creating a post, or settings. Explore's search box
and its results stay usable while the Explore grid is blocked.

## Status

Experimental and not published to any store. One source tree builds for
Chromium and for Firefox. The Chromium build has three test layers, one of them
against the live site. The Firefox package passes `web-ext lint` and has no
automated runtime test; [Build targets](./build-targets.md) explains why.

## Repository layout

| Path                               | What lives there                                                    |
| ---------------------------------- | ------------------------------------------------------------------- |
| `manifest.config.ts`               | the MV3 manifest, switched on `EXT_TARGET`                          |
| `vite.config.ts`                   | output directory and dev server origin, on the same variable        |
| `src/background/service-worker.ts` | the toggle command and the binding mirror the content script reads  |
| `src/content/content-script.ts`    | the content script entry: listeners, route tracking, scheduling     |
| `src/content/routes.ts`            | which sections a path may hide, and which one the card controls     |
| `src/content/selectors.ts`         | what each section hides and which videos it silences                |
| `src/content/blocking.ts`          | the section attributes on `<html>`                                  |
| `src/content/blockingStyles.ts`    | the generator for `blocking.css` and the ready gate                 |
| `src/content/media.ts`             | pausing, muting and giving videos back                              |
| `src/content/overlay.ts`           | the in-page card and block button                                   |
| `src/popup/`                       | the popup                                                           |
| `src/shared/`                      | the settings contract, the shortcut parser, the Instagram URL check |
| `src/test/`                        | Vitest setup, the Chrome API mock, the media stub, fixture markup   |
| `tests/`                           | source-tree guards that run inside Vitest                           |
| `e2e/specs/`                       | the fixture Playwright suite                                        |
| `e2e/real/`, `e2e/manual/`         | the signed-in lanes against live Instagram                          |
| `scripts/`                         | icon rendering, browser launchers, the inspector, the release tools |
| `store/logo.svg`                   | the mark every icon renders from                                    |
| `store/logo-dusk.svg`              | the standby mark, for a store that objects to the gradient          |
| `store/description.txt`            | the long description both stores publish verbatim                   |
| `store/screenshots/`               | the listing screenshots both stores publish                         |
| `amo/`                             | the addons.mozilla.org listing, previews and reviewer answers       |
| `chrome-web-store/`                | the Chrome dashboard privacy and permission answers                 |
| `public/icons/`                    | the rendered icons, committed                                       |

Git ignores `dist/`, `dist-firefox/`, `release/`, `media-capture/`,
`test-results/`, `playwright-report/` and `.e2e/`. The last one holds the
signed-in browser profile.

## Out of scope

- The Instagram app and the mobile site.
- Hiding the Reels and Explore links in the navigation. The destinations are
  blocked and the links stay.

## Related projects

The same idea for other sites:
[tiktok-feed-blocker](https://github.com/shbernal/tiktok-feed-blocker) and
[linkedin-feed-blocker](https://github.com/shbernal/linkedin-feed-blocker).
