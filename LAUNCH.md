# Before launch

Everything here must be done before the site is announced or linked from the App Store.

## Screenshots

**Done 2026-11-27** from Daymark `2eb67af`; see [SCREENSHOTS.md](SCREENSHOTS.md). Recapture with
`scripts/capture.sh` and `scripts/import-captures.mjs` whenever the app's UI changes before launch.

## Launch values

All in `src/site.json`:

- `url`: the real domain, if you move off GitHub Pages. Canonical links, sharing tags, the sitemap, and
  robots follow it.
- `supportEmail`: done, `daymark.app.support@gmail.com` (set November 6, 2026).
- `appStoreId`: **pending App Store launch.** The numeric App Store ID. When set, "Coming soon to the App Store" becomes a download
  link and the Smart App Banner turns on.
- `updated`: the date the privacy policy last changed.

## Check before announcing

- `npm test` passes.
- Every privacy and support claim still matches the app.
- The deployed site matches the last commit (see README).
