# CI and release flow

Publishing a GitHub Release is the whole release. Two workflows fire on it, one
per store, and neither needs anything typed by hand. Both stores are fed from
the one source tree; see [Build targets](./build-targets.md).

## Workflows

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`, in two
jobs so a browser-level flake reddens only the end-to-end signal: `validate`
runs format, lint, typecheck, coverage, build and `lint:firefox`, and `e2e` runs
the Playwright fixture suite and uploads its report.

`.github/workflows/publish-cws.yml` and `.github/workflows/publish-amo.yml` both
run when a GitHub Release is published. They are independent: neither waits for
the other, and each repeats every CI gate itself, so a release cannot ship past
a red suite through either path even when it was cut without a green run behind
it.

`.github/dependabot.yml` opens weekly update pull requests for npm dependencies
and GitHub Actions. Both stores' reviewers flag stale bundled dependencies, so
the shipped tree keeps moving even when nothing else changes.

Release tags use a leading `v`, for example `v0.1.0`. Both workflows strip it
and require the rest to equal `package.json`'s `version` exactly. Neither store
accepts a version number twice, so every release bumps `package.json` first.

## Chrome Web Store

The job runs in the GitHub environment `chrome-web-store`, checks out the tag,
runs the gates, verifies the configuration and the tag, zips `dist/`, then:

1. Authenticates to Google Cloud through GitHub OIDC.
2. Refuses to go on if a previous submission is still `PENDING_REVIEW` or
   `STAGED`. Chrome answers an upload against such an item with a bare 400, and
   the adjacent TikTok blocker lost a release to one; this names the pending
   version instead.
3. Uploads the zip with Chrome Web Store API v2 and polls upload processing.
4. Submits the item for publishing.
5. Attaches the zip to the GitHub Release.

The two steps that write a response to a file take the status from curl's
`-w '%{http_code}'` rather than from `--fail-with-body`, which writes the body
and then exits non-zero, aborting the step under `bash -e` before anything
prints it. Whatever Chrome answers is printed before the status is checked.

The listing copy is not pushed by the workflow. `store/description.txt` and
`store/screenshots/` are pasted into the Developer Dashboard, and the privacy
and permission answers live in
[`chrome-web-store/privacy-justifications.md`](../chrome-web-store/privacy-justifications.md).

## addons.mozilla.org

The job runs in the GitHub environment `addons-mozilla-org` with the secrets
`MOZILLA_ADDON_JWT_ISSUER` and `MOZILLA_ADDON_JWT_SECRET`. It verifies both
before the checkout, so a missing credential fails in seconds rather than after
the gates and packaging.

It then runs the gates, verifies the tag, runs `pnpm package:source` **before**
the build so the archive cannot pick up build output, runs `pnpm
package:firefox`, lints the package with `web-ext`, attaches both zips to the
release, and runs `pnpm publish:amo`.

`scripts/publish-amo.mjs` drives AMO API v5 directly rather than going through
`web-ext sign`, which reports listed-channel review state poorly and has been
seen to exit non-zero on submissions that actually succeeded.

Every run **reconciles**. It reads what AMO already has and writes only what is
missing, in order:

1. the version, unless AMO already has this one
2. the source archive, unless that version already has one
3. the listing icon, unless AMO serves the same pixels
4. the previews in `amo/previews.json`: upload what is missing, fix position and
   caption, delete what the manifest no longer lists

Images are compared by decoded pixels, which is why every screenshot must be a
PNG: AMO re-encodes on ingest and only a PNG comes back with the same pixels.

A `PUT` on the guid creates the add-on when AMO has never seen it, so the first
release needs no hand-made listing.

**A successful AMO release ends in review, not live.** A listed version is
queued for human review, so the expected outcome is a file status of
`unreviewed`. AMO requires a source archive with every version because the
package is bundled by Vite; that is an ongoing obligation, not a first
submission hurdle. See
[Source code submission](../amo/source-submission.md) and
[Data collection](../amo/data-collection.md).

`pnpm publish:amo --check` re-proves the credentials on their own: one
authenticated `GET`, printing the account it resolved to. `--plan` reads AMO and
prints the writes a real run would make. `--dry-run` makes no authenticated call
at all.

### When AMO throttles

AMO's write throttles are paced rather than only retried, and a release spends
several calls against a per-user budget shared with the adjacent TikTok and
LinkedIn blockers. When the wait is longer than the run may serve,
`publish-amo.mjs` exits `75`, having written `resume_at`.

The workflow reads that as "throttled, resume later" rather than as a failure.
It starts a later `workflow_dispatch` run on the same tag with `not_before` set,
whose `wait` job sleeps until then and whose publish job continues from whatever
AMO reports by that point. The chain is bounded by a `deadline`, three days by
default; past it the run fails, and that failure is the notification. A
`concurrency` group of one keeps two runs from spending the budget together.

Nothing is lost to a deferral: the packages are attached to the release before
the submission, and a reconcile finishes the part that did not land.

## GitHub and Google Cloud configuration

The Chrome workflow uses these repository variables. They are identifiers and
configuration, not credentials; do not store a Google service-account JSON key
for this flow.

- `CWS_EXTENSION_ID`, `CWS_PUBLISHER_ID`
- `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT`, `GCP_WORKLOAD_IDENTITY_PROVIDER`

It needs `contents: write` to attach the zip and `id-token: write` to request
the OIDC token. The AMO workflow needs only `contents: write`, and mints its own
JWT per request because AMO caps a token's life at five minutes past `iat`,
shorter than the validation poll can run.

Chrome publishing authenticates through Google Cloud Workload Identity
Federation, shared with the sibling extensions: a service account authorized in
the Developer Dashboard, a pool provider that trusts GitHub Actions OIDC tokens,
and an IAM binding letting this repository impersonate the service account. The
provider's attribute condition names every repository allowed to use it and
restricts them to tag refs, so pull requests and branch pushes cannot reach the
service account. Adding a repository means editing that condition **and** adding
its `principalSet` to the service account's `roles/iam.workloadIdentityUser`
binding.

## Cutting a release

1. Bump `version` in `package.json`.
2. Run the full gate:

   ```sh
   pnpm format && pnpm lint && pnpm typecheck && pnpm test:coverage && \
     pnpm build && pnpm e2e && pnpm lint:firefox
   ```

3. For a content-script, selector or popup change, run the real-site lane:
   `pnpm e2e:real`, with a session from `pnpm e2e:real:setup`.
4. Check whether `store/description.txt` or `store/screenshots/` need to change
   for what shipped. `store/` is shared: an edit there is a queued AMO change as
   well as a Chrome dashboard paste. `pnpm store:shots` rebuilds the screenshot
   set from real Instagram and writes it to `media-capture/store/`; copy images
   across by hand after looking at them.
5. Commit, push `main`, and publish a GitHub Release with the matching tag.
6. Watch both runs, then confirm Chrome shows the version as submitted and AMO
   shows it as awaiting review.

## When a publish job fails

The two jobs are independent, and a store that rejected a submission usually has
not recorded the version at all, so the same tag can be re-run until it lands:

```sh
gh run rerun <run-id> --repo shbernal/instagram-feed-blocker
```

A re-run replays the original commit, so it will not pick up a fix pushed
afterwards; that reaches the next release. What it is for is a store-side
condition that has since cleared.

## Useful checks

```sh
gh run list --repo shbernal/instagram-feed-blocker --limit 10
gh run watch <run-id> --repo shbernal/instagram-feed-blocker --exit-status
gh release view v0.1.0 --repo shbernal/instagram-feed-blocker \
  --json tagName,isDraft,assets,url
gh variable list --repo shbernal/instagram-feed-blocker
```

What Chrome actually serves:

```sh
curl -sI "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=200&acceptformat=crx3&x=id%3D<extension-id>%26uc" |
  grep -i location
```
