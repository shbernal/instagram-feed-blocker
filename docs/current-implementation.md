# Current implementation

Three runtime parts share settings through `chrome.storage.local`: the popup,
the background worker and the content script.

## Manifest

`manifest.config.ts` asks for `storage` and `activeTab`, host access to
`*.instagram.com`, and declares the toggle command, the popup and one content
script entry. That entry injects `src/content/content-script.ts` and
`src/content/blocking.css` into every Instagram page at `document_start`.

The entry has no route scoping. Instagram navigates client-side, and the
browser evaluates `matches` only on a full page load, so a stylesheet scoped to
`/reels/` would stay applied after a click to Messages. The content script does
the route scoping instead.

The background entry and the content script need different file names. crxjs
names each output chunk after its entry's basename, and a collision makes
`service-worker-loader.js` import the wrong chunk.
`tests/manifest-entry-names.test.ts` guards this.

## Settings

`src/shared/settings.ts` is the contract between the popup, the content script
and storage.

- Five sections: `homeFeed`, `homeStories`, `homeSuggestions`, `explore`,
  `reels`.
- `overlay` turns the in-page card on or off. It is not a section, so blocking
  all sections never changes it.
- `active` is recomputed from the sections on every write and never read from
  storage as a choice.
- `normalizeSettings` returns an explicit object literal. A field left out of it
  is dropped on every read.

There is no migration code, because no older settings shape was ever published.

Adding or removing a section touches the settings contract, `routes.ts`, both
tables in `selectors.ts`, the popup, the card's labels and this doc.

## Background worker

On every start, `src/background/service-worker.ts` reads the resolved binding
of `toggle-current-page-block` with `chrome.commands.getAll` and writes it to
the `toggleShortcut` storage key. Content scripts cannot read
`chrome.commands`, and the in-page listener has to answer the keys the browser
actually bound, including a binding the user changed.

When the command fires, the worker sends `toggleCurrentPageBlock` to the active
tab if that tab is on Instagram. The content script also listens for the bound
keys on the page and ignores a second toggle within 500ms, so a keypress that
reaches both paths toggles once.

## Popup

`src/popup/App.tsx` reads settings, writes the normalized copy back, and shows a
master switch, one switch per section grouped by page, and the overlay switch.
Each change goes to storage and to the active tab as `updateSettings`. The
content script also follows storage changes, so a tab that misses the message
still updates.

## Routes

`src/content/routes.ts` maps a pathname to the sections that may be hidden
there. It ignores the query string, so the Following feed at
`/?variant=following` counts as Home.

| Path                      | Sections                                     |
| ------------------------- | -------------------------------------------- |
| `/`                       | `homeFeed`, `homeStories`, `homeSuggestions` |
| `/explore/` exactly       | `explore`                                    |
| `/reels/`, `/reels/<id>/` | `reels`                                      |
| `/stories/...`            | transparent                                  |
| anything else             | none                                         |

The story viewer opens over Home, which stays mounted underneath, and closing it
returns to `/`. A transparent route keeps whatever the previous route applied,
so the feed does not come back behind the viewer.

A reel shared by link is `/reel/<id>/`, singular. It is an ordinary post page
and stays playable. So are posts, which open as full pages at `/p/<id>/` even
when clicked from the feed. Profiles and their Reels tab, the rest of
`/explore/`, Messages and the notifications panel get nothing. The panel does
not change the route at all.

`getRoutePrimarySection` names the section the in-page card controls. It is the
first section the route lists.

## Selectors

`src/content/selectors.ts` holds two tables. `SECTION_SELECTORS` says what each
section hides, and `SECTION_MEDIA_SELECTORS` says which videos it silences.

| Section           | Hides                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `homeFeed`        | `main[role="main"] div:has(> [role="tablist"])`, `main[role="main"] div:has(> div > div > div > article)`, `main[role="main"] article`               |
| `homeStories`     | `[data-pagelet="story_tray"]`                                                                                                                        |
| `homeSuggestions` | `main[role="main"] div:has(> div > div > div > a[href="/explore/people/"])`                                                                          |
| `explore`         | `main[role="main"] > div > div:has(> div > [role="tablist"]):not(:has(input))`, `main[role="main"] > div > div:has(a[href^="/p/"]):not(:has(input))` |
| `reels`           | `main[role="main"]:has([data-virtualized] video)`                                                                                                    |

No selector names a class. Instagram's class names are atomic and change with
every build. The anchors are landmarks, roles, `data-pagelet`,
`data-virtualized` and `href` shapes, as observed on desktop Instagram with an
English interface in September 2026.

What each one relies on:

- Home, wide layout. The centre column holds the tabs, the stories tray and the
  feed wrapper as siblings. The wrapper sits exactly three `div` levels above
  the posts. Hiding it also hides the infinite-scroll loader, so a hidden feed
  stops loading more posts. The plain `article` selector still covers the posts
  if that depth moves.
- Home, right rail. It holds the account switcher, the suggestions block and
  the footer. Only the suggestions block goes, found through its See all link
  four levels down. The rail disappears below about 1100px.
- Home, narrow layout, below about 768px. There are no tabs. A For you dropdown
  and a search box sit in a header outside `main` and stay visible.
- Explore. `main > div` holds three slots: search, tabs and the grid. Focusing
  the search box collapses them into one slot with the input, its own tabs and
  the results. `:not(:has(input))` keeps search usable while the grid is
  blocked.
- Reels. The navigation sits outside `main`. The selector needs the mounted
  player, not just `main`, for the reason in the next section.

The depth-exact `:has(> div > ...)` chains are the fragile part. When Instagram
moves a wrapper they stop matching with no error, and only the real-site lane
notices.

Where a section applies is the route table's decision. A selector can match on
other routes, and profile pages do have a tablist, which is harmless because
the section attribute is never set there.

### The stale Reels address

Leaving Reels a few seconds after opening it, Instagram pushes the new route
and, about 200ms later, the unmounting player calls `replaceState` with its
first reel's id. Messages renders under a `/reels/<id>/` address and the route
table says Reels. It happened in one attempt out of three, and again in one out
of five, when clicking Messages shortly after opening Reels on 2026-09-14.

A Reels rule keyed on `main` alone hid the Messages page in that state. Keying
the rule, the Reels media and the card on the mounted player means a stale
address hides nothing. The cost is the first moment on bare `/reels/`, before a
reel mounts, when the Reels header is still visible. That lasted up to about
3 seconds in the same measurements.

## Hiding

Blocking a section sets one attribute on `<html>`, such as
`data-igfb-home-feed-blocked`. `src/content/blocking.css` hides
`html[data-igfb-home-feed-blocked] <selector>` with `display: none !important`.
The attribute is the only thing that means "the extension hides this", and
clearing it is the whole restore.

Because the hiding is CSS, anything Instagram mounts later is hidden as it
mounts, on any route, with no re-query.

`src/content/blockingStyles.ts` generates `blocking.css` from
`SECTION_SELECTORS`. `tests/blocking-css.test.ts` fails if the checked-in file
differs from the generator's output by a single byte. Regenerate it with
`UPDATE_BLOCKING_CSS=1 pnpm test` and never edit it by hand.

An inline `display` that Instagram sets itself would beat the stylesheet with no
warning. Check for one first if a section stops hiding.

### The curtain

The same stylesheet hides every target of every section while `<html>` lacks
`data-igfb-ready`, with `content-visibility: hidden` and `visibility: hidden`.
The content script sets the attribute once it has read settings and applied
them. If the storage read never answers, it applies the defaults and sets the
attribute after 1500ms.

The curtain covers all sections at once because CSS cannot see the address.
That includes the Reels player's `main`, which is why the curtain uses
properties an animation can restore: after 4000ms the rule lifts itself, so a
content script that never runs cannot leave Instagram blank. `display: none`
cannot be animated back.

The attribute only ever goes on. Teardown sets it rather than removing it.

On live Instagram the curtain has not had to act. Three hard reloads each of `/`
and `/reels/`, with a `requestAnimationFrame` recorder installed before any page
script, found no frame in which a post, the stories tray or the Reels player was
visible. The ready attribute was already set the first time each of them
existed. The tray appeared around frame 20, posts and the Reels player around
frames 136 to 162. Instagram renders after its own bundles load, which is later
than the settings read, so the curtain stays a backstop for a slow read.

## Route tracking

Instagram navigates with the History API. The content script re-evaluates the
route from three signals:

- the Navigation API's `currententrychange` event, where the content script can
  observe it;
- `popstate`, for back and forward;
- a mutation observer on `document.documentElement` that compares the pathname
  with the last applied one.

The observer schedules at most one pass per 100ms. On a route with sections it
also schedules a pass when nodes are added, because a newly mounted video needs
silencing and the card needs its target. On a route without sections it only
compares the pathname. Nothing polls on an interval.

## Media

CSS hides a video without stopping it. `src/content/media.ts` pauses and mutes
the videos that `SECTION_MEDIA_SELECTORS` names for each blocked section.

| Section    | Videos                                      |
| ---------- | ------------------------------------------- |
| `homeFeed` | inside `main[role="main"] article`          |
| `explore`  | inside the grid slot, never while searching |
| `reels`    | inside `[data-virtualized]` within `main`   |

Every Instagram video starts muted and makes sound only after the user unmutes,
which Instagram then remembers. So stopping means pausing, and muting covers a
user who unmuted earlier. Volume is left alone.

Before touching a video the extension records its `muted` and `paused` state on
the element, once, as `data-igfb-previous-muted` and
`data-igfb-previous-paused`. Each pass restores any recorded video that no
longer matches a blocked section's media selector, whether its section was
unblocked, the route changed, or the video moved. Restoring removes both
attributes before resuming, and a video that was paused before stays paused.

Instagram restarts playback from its own visibility logic, so a capture-phase
`play` listener pauses any recorded video that starts again.

Media follows the page, like the stylesheet, and never the address alone. Under
the stale Reels address, an address-based sweep would pause a reel someone sent
in a thread.

## The in-page card

`src/content/overlay.ts` puts a card with the section's switch in the middle of
a blocked page. Once the switch is off, a Block button at the bottom centre
turns it back on.

- The card controls the route's primary section, which is the Home feed,
  Explore or Reels. Stories and suggestions are popup settings. The keyboard
  shortcut still toggles every section of the route.
- It only appears when the primary section's targets are in the page. That
  keeps it off Messages under the stale Reels address, off Explore while
  searching, off the story viewer, and away until Instagram has rendered.
- The Block button sits at the bottom centre because the narrow layout's search
  box is at the top right and Instagram's floating Messages button is at the
  bottom right. Below 768px it moves up to clear the bottom navigation bar.
- It is built with `createElement` rather than `innerHTML`, which leaves
  `web-ext lint` nothing to flag in the extension's own code.
- Rendering again in the same state writes nothing to the DOM. The content
  script renders on Instagram's DOM churn, and rewriting identical text would be
  churn of its own.
- Its dark palette follows `prefers-color-scheme`. Nobody has checked it against
  Instagram's own appearance setting.

## Keyboard shortcut

`Ctrl+Shift+9`, or `Command+Shift+9` on macOS, toggles every section of the
current route. If any of them is off, all of them turn on. Otherwise all of them
turn off. It does nothing on a route without sections, on the story viewer, or
while focus is in a text field.

## Chrome API calls

Every `chrome.*` call uses the callback form. Firefox exposes `chrome.*` with
callbacks only, so an awaited call resolves to `undefined` there and throws
nothing. `tests/browser-api-compat.test.ts` fails on any `await chrome.` under
`src/`.
