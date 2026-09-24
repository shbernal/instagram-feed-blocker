# Documentation

Contributor notes for Instagram Feed Blocker. The README covers what the
extension does for the people using it. These notes cover how it works and how
to change it without breaking something quietly.

- [Project overview](./project-overview.md). What the extension blocks and
  keeps, and where each part of the repository lives.
- [Current implementation](./current-implementation.md). Routes, selectors,
  the stylesheet and its curtain, route tracking, media, the in-page card, and
  the settings contract.
- [Testing](./testing.md). The three test layers, the fixture rule, the
  signed-in real-site lane, and the manual checklist.
- [Build targets](./build-targets.md). The Chromium and Firefox builds, how
  their manifests differ, and what `web-ext lint` reports.
- [Icon explorations](./icon-explorations.md). The mark directions tried and
  rejected, and why the crescent shipped.
- [CI and release flow](./ci-release-flow.md). What a GitHub Release sets off,
  how each store is fed, and what to do when one of them says no.

## Which doc to update

| When this changes                                                          | Update                      |
| -------------------------------------------------------------------------- | --------------------------- |
| routes, selectors, the stylesheet, media, the card, settings, the manifest | `current-implementation.md` |
| test layers, commands, fixtures, the Chrome API mock, the real-site lane   | `testing.md`                |
| the build switch, manifest differences, Firefox lint results               | `build-targets.md`          |
| the repository layout or scope                                             | `project-overview.md`       |
| the mark, or a direction tried and rejected                                | `icon-explorations.md`      |
| the workflows, the store listings, or how a release is cut                 | `ci-release-flow.md`        |

The notes describe the code as it is. When a note and the source disagree, the
source wins and the note gets fixed in the same change.
