# Screenshot refresh plan

Branch `screenshots-refresh`. Replaces every capture on the site with new simulator captures of the
current app (Daymark `main` at `2eb67af`, after the Today, Rituals, Focus, Review, Shelf and Ask
rebuilds, PRs #1–#8). Supersedes the "Screenshots are out of date" hold in [LAUNCH.md](LAUNCH.md).

## Rules

- **Real captures only.** Every image is the app running on a simulator (or, for Ask, the device; see
  step 4). No mock-ups or edits beyond scaling.
- **Looks like a real person's day.** The data is the app's built-in sample day, seeded on the capture
  day and then kept as ordinary data (its `isSample` flags turned off), so no "Sample day" banner or
  "Start fresh" link shows. The content is unchanged; only the flag is.
- **Raw captures go to Drive, not git.** Full-resolution PNGs go to
  `Daymark UI review screenshots/Website/2026-11-19-recapture/` (see the Daymark repo's `AGENTS.md`).
  This repo takes only the scaled WebP files the site serves.
- **One build for everything.** All captures come from one build of the same Daymark commit, recorded
  in the Drive folder's `build.txt` with its SHA.

## Inventory

32 captures today, all taken October 19, 2026.

| Section | Captures | Size | What changed in the app since |
|---|---|---|---|
| Hero | `today` | 920×2000 | Next up card, weather band, Today layout |
| Today | `today-brief`, `-weather`, `-timeline`, `-month`, `-tasks`, `-block-time` | 920×2000 | Weather band, Day overlap columns, event details, composer above tasks |
| Rituals | `rituals` | 920×2000 | Rebuilt: Week ring, "so far" counts, the record |
| Focus | `focus`, `-timers`, `-history`, `-ambient` | 920×2000 | Rebuilt |
| Review | `review` | 920×2000 | Rebuilt: daybook leaf, honest marks |
| Shelf | `shelf`, `shelf-entry`, `search` | 920×2000 | Rebuilt: shared page grammar, Recently deleted |
| Ask | `ask-brief`, `gemma-task`, `gemma-grounded`, `open-chat` | 920×2000 | LiteRT-only assistant |
| Settings | `welcome`, `appearance`, `notifications`, `calendar`, `data` | 920×2000 | Today layout setting added |
| iPad | `ipad-today`, `-rituals`, `-focus`, `-review` | 1600×1200 | All rebuilt; Shelf now has a spread |
| Daylight | `predawn`, `dawn`, `parchment`, `dusk`, `nightfall`, `night` | 540×1174 | Paper tones |
| Sharing | `og.png` | 1200×630 | Shows the old logo |

## Steps

1. **Settle the list (decisions below), then lock the Daymark commit.** Build it once for the simulator
   and record the SHA. No app changes during the capture run; a fix means a new build and a full rerun of
   the affected section.
2. **Capture the phone set on iPhone 18 Pro** (402×874 pt at 3×, 1206×2622). Scaled to 920 wide it
   gives 920×2000, so no cropping is needed. Light appearance, sample data, welcome skipped,
   system sync, notifications and Spotlight off, quiet automation, a fixed date and time
   (`-DaymarkTodayOverride`) so every capture shows the same day.
   - Plain views open straight from launch arguments: `-DaymarkTab`, `-DaymarkScrollTo`,
     `-DaymarkOpenSettings`, `-DaymarkSettingsScroll`, `-DaymarkOpenTasks`, `-DaymarkOpenAssistant`.
   - States that need a tap (brief sheet, block time, month, shelf entry, focus running, search) come from
     one new UI test, `WebsiteCaptureUITests`, following `RitualsLedgerUITests.testCaptureManifest`.
   - Driven by one script, `docs/website-captures/capture.sh` in the Daymark repo, built on the existing
     tab `capture.sh` scripts (agent-device at density 3, or an `.xctestrun` batch when another session
     holds the simulator).
3. **Capture the iPad set on iPad Pro 13-inch, landscape** (2752×2064, scaled to 1600×1200), from the
   same UI test, since landscape needs a rotation.
4. **Ask captures need the real model.** The simulator can't run Gemma, and a stubbed answer
   (`-DaymarkModelStub`) would not be a real capture. Take `gemma-task`, `gemma-grounded` and `open-chat`
   on the physical iPhone 15 Pro Max with the model installed, using the same backup-and-restore of the
   phone's data as Phase 3. `ask-brief` can come from the simulator if it shows no model output.
5. **Daylight stills.** Six captures of Today at each paper tone, on the iPhone 18 Pro, scaled and
   cropped to 540×1174 to match the current set.
6. **Check every capture before importing it.** No clipped rows, the sample banner visible where
   expected, no debug or test strings (`Daymark Test Calendar`, `Seeded by Daymark sync QA`), and the
   status bar clean (9:41, full battery, via the simulator's status-bar override). Contact sheet to
   Drive.
7. **Import.** A small `scripts/import-captures.mjs` (sharp, already a dependency) turns the Drive PNGs
   into WebP at the sizes above, under the same file names, so `tour-data.json` paths do not change.
   Then `npm run images` for the 600px copies.
8. **Update the copy.** Recheck every `title`, `body`, `detail`, `alt` and `caption` in
   `src/tour-data.json` against its new capture. Alt text describes what is actually on screen.
9. **Regenerate `og.png`** from the new hero capture and the current icon.
10. **Verify.** `npm test` (axe light and dark, overflow at 390 and 1440, links, no outside requests,
    iPad tabs, Reduce Motion), then a visual pass of the built site at phone and desktop widths in
    light and dark.
11. **Ship.** PR from this branch to `main`. Merging deploys to GitHub Pages; check the live site
    matches the merge commit.

## Decisions (settled 2026-11-26)

1. **iPad adds Shelf** (`ipad-shelf`, the two-page spread). The section's tabs take a fifth entry.
2. **Today adds two steps**: `today-layout` (Settings → Today layout) and `today-event` (Event details).
3. **Ask on device**: `gemma-task`, `gemma-grounded` and `open-chat` are recaptured on the iPhone 15 Pro
   Max with the model (step 4). `ask-brief` is the simulator's typed "Brief me" command, which needs no
   model.

## Status

**Done 2026-11-27.**

- Simulator set (iPhone 18 Pro, iPad Pro 13-inch) captured at 10:00 from one build of Daymark `2eb67af`:
  Drive `Website/2026-11-27-recapture/` with `build.txt` (sha256 650df01d…). Each Daylight tone is
  captured at its own hour so the greeting matches the paper.
- Ask on the iPhone 15 Pro Max with Gemma 4 Fast: Drive `Website/2026-11-26-ask-device/`, by
  `DaymarkUITests/WebsiteAskCaptureUITests` with the phone's data backed up, swapped and restored
  (verified byte-identical). `gemma-task` is the typed-command path, and its copy says so.
- Imported with `scripts/import-captures.mjs`; `og.png` regenerated from the new hero capture.
- The tour was then cut from 24 stops to 14 (review finding #1, branch `site-review-fixes`); the cut
  captures stay in Drive.

## Capture script

`scripts/capture.sh` takes every simulator shot (phone set, Daylight set, iPad set) with agent-device
from T3's `device_open`. It seeds the data, turns off the sample flags, restores that copy before each
shot, pins the status bar to 9:41, and refuses to mix builds in one folder (`build.txt`).

Run the phone and iPad sets in the morning, around 10:00. The timeline and greeting are pinned to
10:20, but the brief, event details, the weather card and countdown times follow the real clock, so
an evening run shows night weather and tomorrow's event. The trial run on 2026-11-26 (evening) checked
framing only.

## Done when

- Every asset in `src/tour-data.json` and the hero is from the locked build, and `build.txt` in Drive
  names it.
- `npm test` passes and the visual pass is clean.
- LAUNCH.md's screenshot section is marked done, and the remaining launch items are unchanged.
