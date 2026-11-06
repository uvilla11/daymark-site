# Daymark marketing site

A static site with no runtime dependencies, remote fonts, analytics, cookies, or third-party requests.
See [LAUNCH.md](LAUNCH.md) for what must be done before launch, including **recapturing the screenshots**.

## Editing

Edit only `src/`, `src/tour-data.json`, `src/site.json`, and `scripts/`. Never edit `dist/` or the
deployed site by hand: `dist/` is rebuilt from `src/`, so hand edits are lost, and edits made only on the
host never come back to this repo.

- `src/index.html` is a template. The tour, iPad, and Daylight sections come from `src/tour-data.json`.
- `src/site.json` holds the domain, support email, App Store ID, and policy date.
- `src/privacy/`, `src/support/`, and `src/404.html` are pages; `{{…}}` placeholders are filled from
  `site.json`.

## Commands

Node 22 or later. Run `npm install` once, and `npx playwright install chromium` for the tests.

| Command | What it does |
| --- | --- |
| `npm run build` | Builds `dist/` for a host that serves from the root. |
| `SITE_BASE=/daymark-site npm run build` | Builds for GitHub Pages, which serves from `/daymark-site/`. |
| `npm run images` | Makes 600px copies of the phone captures. Run after replacing screenshots. |
| `npm test` | Builds, then checks axe (light and dark), overflow at 390 and 1440px, links, outside requests, the 404 page, sharing tags, iPad tabs, and Reduce Motion. |

## Deploying

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`, which builds with
`SITE_BASE=/daymark-site`. The committed `dist/` is the root build, kept for hosts that serve the folder
as-is.

Before and after each deploy, check that the live site matches the commit you deployed.
