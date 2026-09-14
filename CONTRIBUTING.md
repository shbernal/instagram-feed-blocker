# Contributing

Changes are welcome. Read [AGENTS.md](./AGENTS.md) first for the rules whose
breakage nothing reports, and [docs/index.md](./docs/index.md) for everything
else.

## AI disclosure

Pull requests written with an AI coding tool are fine, including ones written
entirely by one. Almost all of this repository was. Say so in the pull request,
and name the tool and the model. Knowing which parts a person actually read
changes how a review goes.

## Setup

Use pnpm, at the version pinned in `package.json`'s `packageManager` field.

```sh
pnpm install
pnpm dev:chrome     # builds and opens dist/ in Chromium on a throwaway profile
```

The browser tests need a Chromium that can load extensions. The launchers try
the paths in `scripts/chromium-paths.json`, and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` overrides them.

## What to run

| If you touched                             | Run                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------- |
| docs only                                  | `pnpm format`                                                        |
| `src/`, the manifest, `vite.config.ts`     | the full gate                                                        |
| `tests/`, `e2e/`, `src/**/*.test.*`        | `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm e2e`      |
| `src/content/selectors.ts` or the fixtures | the full gate, then `pnpm e2e:real` if you have a signed-in profile  |
| `store/logo.svg`                           | `pnpm icons`, then `pnpm icons --check`, and look at the 16px result |

The full gate:

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test:coverage &&
  pnpm build && pnpm e2e && pnpm lint:firefox
```

## Beyond the gate

- `pnpm e2e:real` needs a signed-in Instagram profile, which
  [docs/testing.md](./docs/testing.md) explains how to set up. It is the only
  check that notices Instagram changing its markup.
- Nothing runs the Firefox package automatically. Use `pnpm dev:firefox` and
  the manual checklist in [docs/testing.md](./docs/testing.md).
- `pnpm icons` and `pnpm icons --check` need `rsvg-convert`.

## What not to put in a pull request

- A version bump.
- `dist/`, `dist-firefox/`, or anything under `.e2e/`.
- Edited icon PNGs or `store/logo-source.png`. Edit `store/logo.svg` and run
  `pnpm icons`.
- An edited `src/content/blocking.css`. Change `src/content/selectors.ts` and
  run `UPDATE_BLOCKING_CSS=1 pnpm test`.
- A different Firefox add-on id.
- Fixture markup adjusted until a selector passes.

## The fixture rule

`src/test/fixtures/instagram.ts` is copied from live Instagram pages and
pruned. When a selector stops matching, capture the real element again. A
fixture adjusted until the selector passes gives a green suite that does nothing
on the real site, and no test will say so.

## Commit messages

Say what the change does and why. Leave out branch names and references to local
working files.
