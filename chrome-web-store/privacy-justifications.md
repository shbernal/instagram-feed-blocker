# Privacy And Permission Justifications

Use this copy for the Chrome Web Store Developer Dashboard privacy and
permission form. Keep each answer aligned with `manifest.config.ts` and current
runtime behavior before submitting a build.

The body text under each heading is the answer itself and goes into a plain-text
form field verbatim, so it stays free of Markdown — no backticks, emphasis, or
lists. Headings are labels, not answers, and may keep their markup.

Last reviewed against `manifest.config.ts`.

## Single Purpose Description

Instagram Feed Blocker helps users reduce distraction on Instagram by hiding
only the endless-scroll surfaces: the Home feed, the story tray, the Suggested
for you module, the Explore grid, and the Reels tab. Each of those is its own
switch in the popup, on the in-page card, or through a keyboard shortcut, and
turning one off restores exactly what was hidden, including whether a video was
playing. Messages, notifications, search, profiles, and a post or reel opened
from a link are never touched. Settings are stored locally in Chrome extension
storage.

## Permission Justifications

### `activeTab`

activeTab is used only after a user action from the popup or the keyboard
command to identify and message the currently active Instagram tab. This lets
the extension apply the user's chosen blocking state to the page they are
viewing without broad tab history access or background scanning of unrelated
tabs.

### `storage`

storage saves the user's local extension settings: whether the Home feed,
stories, suggestions, Explore, and Reels are each blocked, and whether the
in-page card is shown. The extension stores this configuration in
chrome.storage.local; it does not use this permission to collect or transmit
browsing data.

### Host Permission: `*://*.instagram.com/*`

Access to Instagram pages is required because the content script must run there
to tell Home, Explore, Reels, and the pages that stay untouched apart; hide or
restore the selected containers; render the in-page card; and pause or resume
the media inside a hidden section. Instagram navigates client-side, so the
script must already be running when the route changes rather than being injected
per page load. It does not run on non-Instagram sites.
