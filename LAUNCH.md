# Before launch

Everything here must be done before the site is announced or linked from the App Store.

## ⚠️ Screenshots are out of date

**Status: on hold until the app’s UI polish and refinement are complete.**

The tour uses captures from October 19, 2026. The app has changed since then and more UI work is
planned, so **recapture every screenshot once the UI settles, and before launch**. Today alone has a new
Next up card (line art, countdown, "Also at"), a new weather band (larger icon, ↑/↓ high and low, hourly
strip), the event details sheet, the Today layout setting, and overlap columns on the Day page.

To replace them:

1. Capture on the simulator with sample data (`-DaymarkSampleData -DaymarkSkipWelcome`), one capture per
   entry in `src/tour-data.json`, using the same file names in `src/assets/`. Phone captures are
   920×2000, iPad 1600×1200, Daylight 540×1170.
2. Update any captions, alt text, or step copy in `src/tour-data.json` that no longer match. Consider a
   "Choose what Today shows" step for the Today layout setting.
3. Run `npm run images` to remake the 600px copies, then `npm test`.
4. Regenerate `src/assets/og.png` (1200×630). The current one shows the old logo.

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
