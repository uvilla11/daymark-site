import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const output = resolve(root, "dist");
const data = JSON.parse(await readFile(resolve(source, "tour-data.json"), "utf8"));
const template = await readFile(resolve(source, "index.html"), "utf8");

const esc = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
})[char]);

const caption = (label, note) => `<span class="sample-tag">${esc(label)}</span> ${esc(note)}`;
const phoneScreen = (screen, eager = false) => `
  <div class="deck-screen${screen.id === data.hero.id ? " is-active" : ""}" data-screen="${esc(screen.id)}" data-label="${esc(screen.label)}" data-caption="${esc(screen.caption)}" data-state="${screen.id === data.hero.id ? "active" : "after"}">
    <img src="/assets/${esc(screen.asset)}" width="920" height="2000" alt="${esc(screen.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} />
  </div>`;

const allScreens = [data.hero, ...data.chapters.flatMap(chapter => chapter.steps)];
const deck = allScreens.map(screen => phoneScreen(screen, screen.id === data.hero.id)).join("\n");

const ledgerRows = data.ledger.rows.map((row, rowIndex) => {
  const checked = row.kept.length;
  const cells = data.ledger.days.map(([short, day], dayIndex) => {
    if (row.off.includes(dayIndex)) {
      return `<td class="ledger-off"><span aria-hidden="true">–</span><span class="visually-hidden">${esc(day)}: not scheduled</span></td>`;
    }
    const pressed = row.kept.includes(dayIndex);
    return `<td><button type="button" class="ledger-check" aria-pressed="${pressed}" aria-label="${esc(row.name)}, ${esc(day)}" data-row="${rowIndex}" data-day="${dayIndex}" tabindex="-1"><span aria-hidden="true"></span></button></td>`;
  }).join("");
  return `<tr data-ledger-row="${rowIndex}"><th scope="row">${esc(row.name)}<span>${esc(row.cadence)}</span></th>${cells}<td class="ledger-kept"><output>${checked}</output><span> / ${row.target}</span></td></tr>`;
}).join("\n");

const chapters = data.chapters.map(chapter => `
  <section class="chapter" id="${esc(chapter.id)}" data-walk="${esc(chapter.tone)}" data-index="${esc(chapter.id)}" aria-labelledby="${esc(chapter.id)}-title">
    <header class="chapter-head">
      <h2 id="${esc(chapter.id)}-title">${esc(chapter.title)}</h2>
      <p>${esc(chapter.intro)}</p>
    </header>
    <ol class="steps" aria-label="${esc(chapter.nav)} screens">
      ${chapter.steps.map((step, index) => `
      <li class="step" id="${esc(step.id)}" data-screen="${esc(step.id)}">
        <figure class="step-shot">
          <div class="device-frame inline-device"><img src="/assets/${esc(step.asset)}" width="920" height="2000" alt="${esc(step.alt)}" loading="lazy" /></div>
          <figcaption>${caption(step.label, step.caption)}</figcaption>
        </figure>
        <div class="step-copy">
          <h3>${esc(step.title)}</h3>
          <p>${esc(step.body)}</p>
          ${chapter.id === "rituals" ? `<p class="feature-detail">Check in from Today or from the Rituals page.</p>` : ""}
        </div>
      </li>`).join("\n")}
    </ol>
    ${chapter.steps.length > 1 ? `<p class="strip-hint" aria-hidden="true">Swipe to explore <span class="strip-count">· <span class="strip-at">1</span> of ${chapter.steps.length}</span></p>` : ""}
    ${chapter.id === "rituals" ? `
    <figure class="ledger" aria-labelledby="ledger-title">
      <figcaption id="ledger-title"><strong>Try the week ledger.</strong> Select a day to check in, and select it again to clear it.</figcaption>
      <div class="ledger-scroll" tabindex="0" aria-label="Scrollable weekly ritual ledger">
        <table>
          <thead><tr><th scope="col"><span class="visually-hidden">Ritual</span></th>${data.ledger.days.map(([short, full]) => `<th scope="col" abbr="${esc(full)}">${esc(short)}<span class="visually-hidden">${esc(full)}</span></th>`).join("")}<th scope="col">Kept</th></tr></thead>
          <tbody>${ledgerRows}</tbody>
        </table>
      </div>
      <p class="ledger-status" data-ledger-status aria-live="polite"></p>
    </figure>` : ""}
  </section>`).join("\n");

const ipadTabs = data.ipad.map((panel, index) => `<button type="button" id="ipad-tab-${esc(panel.id)}" aria-controls="ipad-panel-${esc(panel.id)}" role="tab" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${esc(panel.name)}</button>`).join("\n");
const ipadPanels = data.ipad.map(panel => `
  <section class="ipad-panel" id="ipad-panel-${esc(panel.id)}" role="tabpanel" aria-labelledby="ipad-tab-${esc(panel.id)}">
    <figure class="ipad-figure">
      <div class="ipad-frame"><img src="/assets/${esc(panel.asset)}" width="1600" height="1200" alt="${esc(panel.alt)}" loading="lazy" /></div>
      <figcaption>${caption(panel.label, panel.caption)}</figcaption>
    </figure>
  </section>`).join("\n");

const phaseControls = data.phases.map((phase, index) => `
  <label class="phase-choice" data-phase-choice="${esc(phase.id)}">
    <input type="radio" name="phase" value="${esc(phase.id)}"${index === 1 ? " checked" : ""} />
    <span class="phase-swatch" data-tone="${esc(phase.id)}" aria-hidden="true"></span>
    <span class="phase-name">${esc(phase.name)}<small data-phase-now${index === 1 ? "" : " hidden"}>Now</small></span>
    <span class="phase-when">${esc(phase.when)}</span>
  </label>`).join("\n");
const phaseFrames = data.phases.map(phase => `
  <figure class="phase-frame" data-phase-frame="${esc(phase.id)}">
    <div class="device-frame daylight-device"><img src="/assets/${esc(phase.asset)}" width="540" height="1170" alt="${esc(phase.alt)}" loading="lazy" /></div>
  </figure>`).join("\n");

const html = template
  .replace("{{PHONE_DECK}}", deck)
  .replace("{{TOUR_SECTIONS}}", chapters)
  .replace("{{IPAD_TABS}}", ipadTabs)
  .replace("{{IPAD_PANELS}}", ipadPanels)
  .replace("{{PHASE_CONTROLS}}", phaseControls)
  .replace("{{PHASE_FRAMES}}", phaseFrames)
  .replace(/[ \t]+$/gm, "");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(source, "assets"), resolve(output, "assets"), { recursive: true });
await cp(resolve(source, "styles.css"), resolve(output, "styles.css"));
await cp(resolve(source, "app.js"), resolve(output, "app.js"));
await cp(resolve(source, "privacy"), resolve(output, "privacy"), { recursive: true });
await cp(resolve(source, "support"), resolve(output, "support"), { recursive: true });
await writeFile(resolve(output, "index.html"), html);
console.log(`Built ${allScreens.length} phone screens, ${data.ipad.length} iPad spreads, and ${data.phases.length} Daylight phases.`);
