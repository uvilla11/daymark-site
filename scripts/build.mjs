import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const esc = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
})[char]);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const output = resolve(root, "dist");
const data = JSON.parse(await readFile(resolve(source, "tour-data.json"), "utf8"));
const template = await readFile(resolve(source, "index.html"), "utf8");
const site = JSON.parse(await readFile(resolve(source, "site.json"), "utf8"));
// GitHub Pages serves this site from a subpath; SITE_BASE=/daymark-site rewrites
// root-relative links. Hosts that serve from the root leave it empty.
const base = (process.env.SITE_BASE || "").replace(/\/$/, "");
const siteUrl = (process.env.SITE_URL || site.url).replace(/\/$/, "");
const exists = path => access(path).then(() => true, () => false);

// A smaller copy (name-600.webp, made by scripts/images.mjs) lets 1x and 2x
// screens skip the full 920px capture. Without one, the image is unchanged.
const phoneSizes = "(min-width: 981px) 300px, 72vw";
const smallVariant = async asset => {
  const small = asset.replace(/\.webp$/, "-600.webp");
  return small !== asset && await exists(resolve(source, "assets", small)) ? small : null;
};
const phoneSrcset = {};
for (const asset of new Set([data.hero, ...data.chapters.flatMap(chapter => chapter.steps)].map(screen => screen.asset))) {
  const small = await smallVariant(asset);
  if (small) phoneSrcset[asset] = ` srcset="/assets/${esc(small)} 600w, /assets/${esc(asset)} 920w" sizes="${phoneSizes}"`;
}
const srcsetFor = asset => phoneSrcset[asset] || "";


const caption = (label, note) => `<span class="sample-tag">${esc(label)}</span> ${esc(note)}`;
const phoneScreen = (screen, eager = false) => `
  <div class="deck-screen${screen.id === data.hero.id ? " is-active" : ""}" data-screen="${esc(screen.id)}" data-label="${esc(screen.label)}" data-caption="${esc(screen.caption)}" data-state="${screen.id === data.hero.id ? "active" : "after"}">
    <img src="/assets/${esc(screen.asset)}"${srcsetFor(screen.asset)} width="920" height="2000" alt="${esc(screen.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} />
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

const chapters = data.chapters.map((chapter, chapterIndex) => `
  <section class="chapter" id="${esc(chapter.id)}" data-walk="${esc(chapter.tone)}" data-index="${esc(chapter.id)}" aria-labelledby="${esc(chapter.id)}-title">
    <header class="chapter-head">
      <h2 id="${esc(chapter.id)}-title">${esc(chapter.title)}</h2>
      <p>${esc(chapter.intro)}</p>
    </header>
    ${chapter.steps.length > 1 ? `
    <div class="strip-controls" data-strip-controls role="group" aria-label="${esc(chapter.nav)} screen controls" hidden>
      <button class="strip-control" type="button" data-strip-step="-1" aria-controls="${esc(chapter.id)}-screens" aria-label="Previous screen" disabled><span class="strip-control-arrow" aria-hidden="true">←</span><span>Previous</span></button>
      <output class="strip-position" data-strip-position aria-live="polite" aria-atomic="true" aria-label="Screen 1 of ${chapter.steps.length}">1 / ${chapter.steps.length}</output>
      <button class="strip-control" type="button" data-strip-step="1" aria-controls="${esc(chapter.id)}-screens" aria-label="Next screen"><span>Next</span><span class="strip-control-arrow" aria-hidden="true">→</span></button>
    </div>` : ""}
    <ol class="steps" id="${esc(chapter.id)}-screens"${chapter.steps.length > 1 ? ' tabindex="0"' : ""} aria-label="${esc(chapter.nav)} screens">
      ${chapter.steps.map((step, index) => `
      <li class="step" id="${esc(step.id === chapter.id ? `${step.id}-screen` : step.id)}" data-screen="${esc(step.id)}">
        <figure class="step-shot">
          <div class="device-frame inline-device"><img src="/assets/${esc(step.asset)}"${srcsetFor(step.asset)} width="920" height="2000" alt="${esc(step.alt)}" loading="lazy" /></div>
          <figcaption>${caption(step.label, step.caption)}</figcaption>
        </figure>
        <div class="step-copy">
          ${chapter.steps.length > 1 ? `<p class="step-sequence" aria-label="Screen ${index + 1} of ${chapter.steps.length}">${index + 1} <span aria-hidden="true">/</span> ${chapter.steps.length}</p>` : ""}
          <h3>${esc(step.title)}</h3>
          <p class="step-summary">${esc(step.body)}</p>
          ${step.detail ? `<p class="step-detail">${esc(step.detail)}</p>` : ""}
        </div>
      </li>`).join("\n")}
    </ol>
    ${chapter.steps.length > 1 ? `<p class="strip-hint">Swipe to explore. Each card is numbered.</p>` : ""}
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
    <span class="phase-name">${esc(phase.name)}</span>
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

const contactLink = site.supportEmail
  ? `<a href="mailto:${esc(site.supportEmail)}">${esc(site.supportEmail)}</a>`
  : null;
const fills = {
  UPDATED: esc(site.updated),
  CONTACT_HERO: contactLink
    ? `This page covers common setup and data questions. For anything else, write to ${contactLink}.`
    : "This page covers common setup and data questions; a direct contact channel is not yet available in this preview.",
  CONTACT_SECTION: contactLink
    ? `Write to ${contactLink}. Include your device, iOS version, and what you expected to happen.`
    : "A direct contact address is not yet available in this preview. It will be listed here before launch.",
  CONTACT_SENTENCE: contactLink ? `Questions go to ${contactLink}.` : "A contact address will be listed here before launch.",
};
const appStoreUrl = site.appStoreId ? `https://apps.apple.com/app/id${encodeURIComponent(site.appStoreId)}` : null;

const headTags = ({ path, html, noindex = false }) => {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? site.name;
  const description = html.match(/name="description"\s+content="([^"]*)"/)?.[1] ?? "";
  const url = `${siteUrl}${path}`;
  const tags = [
    noindex ? `<meta name="robots" content="noindex" />` : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(site.name)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${siteUrl}/assets/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
  if (appStoreUrl) tags.push(`<meta name="apple-itunes-app" content="app-id=${esc(site.appStoreId)}" />`);
  if (path === "/") {
    const app = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: site.name, operatingSystem: "iOS 18 or later",
      applicationCategory: "ProductivityApplication", description: description.replace(/&#39;|&quot;|&amp;|&lt;|&gt;/g, m => ({ "&#39;": "'", "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">" })[m]), url };
    if (appStoreUrl) app.downloadUrl = appStoreUrl;
    tags.push(`<script type="application/ld+json">${JSON.stringify(app).replace(/</g, "\\u003c")}</script>`);
  }
  return tags.map(tag => `    ${tag}`).join("\n");
};

const finish = (page, options) => {
  let out = page.replace(/\{\{(UPDATED|CONTACT_HERO|CONTACT_SECTION|CONTACT_SENTENCE)\}\}/g, (_, key) => fills[key]);
  if (/\{\{[A-Z_]+\}\}/.test(out)) throw new Error(`Unfilled placeholder in ${options.path}`);
  if (appStoreUrl) out = out.replaceAll("Coming soon to the App Store", `<a href="${appStoreUrl}">Download on the App Store</a>`);
  out = out.replace("  </head>", `${headTags({ ...options, html: out })}\n  </head>`);
  if (base) out = out.replace(/(\s(?:href|src)=")\/(?!\/)/g, `$1${base}/`).replace(/(srcset="[^"]*")/g, attr => attr.replace(/(^srcset="|, )\//g, `$1${base}/`));
  return out;
};

const pages = [
  { path: "/", file: "index.html", html },
  { path: "/privacy/", file: "privacy/index.html", html: await readFile(resolve(source, "privacy/index.html"), "utf8") },
  { path: "/support/", file: "support/index.html", html: await readFile(resolve(source, "support/index.html"), "utf8") },
  { path: "/404.html", file: "404.html", html: await readFile(resolve(source, "404.html"), "utf8"), noindex: true },
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(source, "assets"), resolve(output, "assets"), { recursive: true, filter: path => !path.endsWith(".DS_Store") });
await cp(resolve(source, "styles.css"), resolve(output, "styles.css"));
await cp(resolve(source, "app.js"), resolve(output, "app.js"));
for (const page of pages) {
  await mkdir(dirname(resolve(output, page.file)), { recursive: true });
  await writeFile(resolve(output, page.file), finish(page.html, page));
}
const indexed = pages.filter(page => !page.noindex);
await writeFile(resolve(output, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
await writeFile(resolve(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed.map(page => `  <url><loc>${siteUrl}${page.path}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`Built ${allScreens.length} phone screens, ${data.ipad.length} iPad spreads, and ${data.phases.length} Daylight phases${base ? ` for ${base}/` : ""}.`);
