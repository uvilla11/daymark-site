const root = document.documentElement;
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const now = () => performance.now() / 1000;
const motionOK = matchMedia("(prefers-reduced-motion: no-preference)");
const storyMode = matchMedia("(min-width: 981px) and (min-height: 620px)");

// The phone, index bead, and paper share one rAF queue. The same retargetable
// closed-form spring used by the original tour keeps value and velocity joined.
const SPRING = { flag: 0.22, trail: 0.36, deck: 0.48 };
const stepResponse = (tau, response) => {
  if (tau <= 0) return 0;
  const w = (2 * Math.PI) / response;
  return 1 - Math.exp(-w * tau) * (1 + w * tau);
};
const spring = initial => {
  let base = initial;
  const terms = [];
  const prune = t => {
    while (terms.length && t - terms[0].t > 3 * terms[0].r) base += terms.shift().d;
  };
  const target = () => terms.reduce((sum, term) => sum + term.d, base);
  return {
    value(t) { prune(t); return terms.reduce((sum, term) => sum + term.d * stepResponse(t - term.t, term.r), base); },
    set(goal, response, t) { const delta = goal - target(); if (Math.abs(delta) > 1e-6) terms.push({ t, d: delta, r: response }); },
    snap(goal) { base = goal; terms.length = 0; },
    target,
    moving(t) { prune(t); return terms.length > 0; },
  };
};

const animators = new Set();
let ticking = false;
let frameId = 0;
const frame = () => {
  if (!motionOK.matches) { stopMotion(); return; }
  const t = now();
  animators.forEach(animate => { if (!animate(t)) animators.delete(animate); });
  if (animators.size) frameId = requestAnimationFrame(frame);
  else ticking = false;
};
const kick = animate => {
  animators.add(animate);
  if (!ticking) { ticking = true; frameId = requestAnimationFrame(frame); }
};

// System paper is the default. The button is a temporary override; no browser
// storage or cookie is needed for a presentation preference.
const themeToggle = document.querySelector("[data-theme-toggle]");
const DARK_PALETTE = new Set(["predawn", "nightfall", "night"]);
let paletteOverride = null;
const paletteIsDark = () => root.dataset.scheme === "dark" || DARK_PALETTE.has(root.dataset.tone);
const updateThemeToggle = () => {
  if (!themeToggle) return;
  themeToggle.hidden = false;
  const dark = paletteIsDark();
  themeToggle.textContent = dark ? "Use light paper" : "Try night paper";
  themeToggle.setAttribute("aria-pressed", String(dark));
};
if (themeToggle) {
  updateThemeToggle();
  themeToggle.addEventListener("click", () => {
    paletteOverride = paletteIsDark() ? "light" : "dark";
    root.dataset.scheme = paletteOverride;
    applyCurrentTone();
  });
}

const TONE_NAMES = {
  predawn: "Predawn", dawn: "Dawn", parchment: "Parchment", dusk: "Dusk", nightfall: "Nightfall", night: "Night",
};
const TONES = Object.keys(TONE_NAMES);
const DARK_TONE = { predawn: "predawn", dawn: "predawn", parchment: "night", dusk: "nightfall", nightfall: "night", night: "night" };
const LIGHT_TONE = { predawn: "dawn", nightfall: "dusk", night: "parchment" };
const phaseInputs = $$('input[name="phase"]');
const phaseNowLabels = $$('[data-phase-now]');
const phaseName = document.querySelector("[data-phase-name]");
const phaseFrames = $$('[data-phase-frame]');
let phaseChosen = false;
let chosenPhase = "dawn";
let currentLogicalTone = root.dataset.tone || "dawn";
const daylightTone = date => {
  const minute = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const sunrise = 6.5 * 60;
  const sunset = 18.5 * 60;
  const dawnStart = sunrise - 75;
  const duskEnd = sunset + 75;
  if (minute < dawnStart - 60 || minute >= duskEnd + 60) return "night";
  if (minute < dawnStart) return "predawn";
  if (minute < sunrise + 75) return "dawn";
  if (minute < sunset - 75) return "parchment";
  if (minute < duskEnd) return "dusk";
  return "nightfall";
};
const clockTone = () => daylightTone(new Date());
const displayTone = tone => paletteOverride === "dark" ? DARK_TONE[tone] || tone : paletteOverride === "light" ? LIGHT_TONE[tone] || tone : tone;
const refreshPhase = tone => {
  phaseInputs.forEach(input => { input.checked = input.value === tone; });
  phaseNowLabels.forEach(label => { label.hidden = label.closest(".phase-choice")?.querySelector('input[name="phase"]')?.value !== clockTone(); });
  const frameShell = document.querySelector(".daylight-screen");
  frameShell?.setAttribute("data-ready", "true");
  phaseFrames.forEach(frame => {
    const selected = frame.dataset.phaseFrame === tone;
    frame.hidden = false;
    frame.classList.toggle("is-selected", selected);
    frame.setAttribute("aria-hidden", String(!selected));
    frame.inert = !selected;
  });
  if (phaseName) phaseName.textContent = TONE_NAMES[tone] || TONE_NAMES.dawn;
};

const setTone = tone => {
  if (!tone || !TONES.includes(tone)) return;
  currentLogicalTone = tone;
  const next = displayTone(tone);
  const previous = root.dataset.tone;
  if (previous && DARK_PALETTE.has(previous) !== DARK_PALETTE.has(next)) {
    root.classList.add("tone-cut");
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("tone-cut")));
  }
  root.dataset.tone = next;
  updateThemeToggle();
  if (document.querySelector("#daylight")) refreshPhase(phaseChosen ? chosenPhase : (tone === "daylight" ? clockTone() : tone));
};
const walkTone = element => {
  const tone = element?.dataset.walk;
  if (tone === "daylight") return phaseChosen ? chosenPhase : clockTone();
  return tone;
};

// Screen stack. A screen rises in as its predecessor moves up across the same
// edge, so a fast reverse scroll simply retargets the same continuous spring.
const stage = document.querySelector("[data-stage]");
const screens = stage ? $$(".deck-screen", stage) : [];
const pictures = screens.map(element => element);
const screenIds = screens.map(element => element.dataset.screen);
const deck = spring(Math.max(0, screenIds.indexOf("today")));
let screenId = "today";
let windowAt = Math.max(0, screenIds.indexOf("today"));
const captions = document.querySelector("[data-stage-caption]");
const screenInfo = new Map();
screens.forEach(el => {
  const image = el.querySelector("img");
  screenInfo.set(el.dataset.screen, {
    alt: image?.alt || "",
    label: el.dataset.label || "Product UI",
    note: el.dataset.caption || el.dataset.screen,
  });
});
const near = (index, position) => index >= Math.floor(Math.min(position, windowAt)) - 1 && index <= Math.ceil(Math.max(position, windowAt)) + 1;
const markNear = position => screens.forEach((element, index) => element.toggleAttribute("data-near", near(index, position)));
const preload = index => {
  for (let i = Math.max(0, index - 1); i <= Math.min(pictures.length - 1, index + 3); i++) {
    const image = pictures[i].querySelector("img");
    if (!image || image.loading === "eager") continue;
    image.loading = "eager";
    image.decode?.().catch(() => {});
  }
};
// Once the critical hero has loaded, warm the tour images so jumping directly
// between chapters never reveals an empty device while a lazy image downloads.
if (screens.length) {
  const warmDeck = () => screens.forEach(element => {
    const image = element.querySelector("img");
    if (!image) return;
    image.loading = "eager";
    image.decode?.().catch(() => {});
  });
  window.addEventListener("load", () => {
    if ("requestIdleCallback" in window) requestIdleCallback(warmDeck, { timeout: 1200 });
    else setTimeout(warmDeck, 250);
  }, { once: true });
}
const renderDeck = t => {
  const position = deck.value(t);
  screens.forEach((element, index) => {
    element.toggleAttribute("data-near", near(index, position));
    const relative = Math.max(-1, Math.min(1, index - position));
    const off = Math.abs(relative) >= 1;
    element.style.visibility = off ? "hidden" : "visible";
    element.style.opacity = off ? "0" : String(Math.max(0, 1 - Math.abs(relative)).toFixed(3));
    if (off) return;
    element.style.transform = `translate3d(0, ${(relative * 6).toFixed(3)}%, 0) scale(${(1 - Math.abs(relative) * .025).toFixed(4)})`;
  });
  return deck.moving(t);
};
const clearDeckStyles = () => screens.forEach(element => {
  element.style.removeProperty("visibility");
  element.style.removeProperty("opacity");
  element.style.removeProperty("transform");
});
const setScreen = (id, instant = false) => {
  const index = screenIds.indexOf(id);
  if (index < 0) return;
  windowAt = index;
  screenId = id;
  markNear(motionOK.matches ? deck.value(now()) : index);
  preload(index);
  screens.forEach((element, i) => {
    element.dataset.state = i < index ? "before" : i > index ? "after" : "active";
  });
  const info = screenInfo.get(id);
  if (captions && info) captions.innerHTML = `<span class="sample-tag">${escapeHTML(info.label)}</span> ${escapeHTML(info.note)}`;
  if (!motionOK.matches) {
    animators.delete(renderDeck);
    deck.snap(index);
    clearDeckStyles();
    return;
  }
  const distant = Math.abs(index - deck.value(now())) > 1.8;
  if (instant || distant) deck.snap(index);
  else deck.set(index, SPRING.deck, now());
  if (stage && root.dataset.storyMode === "desktop") {
    kick(renderDeck);
    if (distant && !instant) {
      stage.closest(".stage-device")?.animate([
        { opacity: .68, transform: "translateY(8px) scale(.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ], { duration: 360, easing: "cubic-bezier(.2, .7, .2, 1)" });
    }
  }
};

const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
})[character]);

// Active page bead: the leading edge advances on the short spring and the
// trailing edge catches up on the longer one. The top line mirrors reading.
const navTrack = document.querySelector("[data-nav-track]");
const navScroll = document.querySelector(".chapter-index");
const navLinks = navTrack ? $$('a[href^="#"]', navTrack) : [];
const bead = document.querySelector(".nav-bead");
const beadLeading = spring(0);
const beadTrailing = spring(0);
let beadPlaced = false;
const renderBead = t => {
  if (bead) {
    const x = beadLeading.value(t);
    const end = beadTrailing.value(t);
    bead.style.transform = `translateX(${x.toFixed(2)}px) scaleX(${Math.max(1, end - x).toFixed(2)})`;
  }
  return beadLeading.moving(t) || beadTrailing.moving(t);
};
let activeIndex = "today";
const placeBead = (link, instant = false) => {
  if (!navTrack || !link || !bead) return;
  const x = link.offsetLeft;
  const end = x + link.offsetWidth;
  if (instant || !beadPlaced || !motionOK.matches) {
    beadLeading.snap(x); beadTrailing.snap(end); beadPlaced = true; renderBead(now()); return;
  }
  const forward = x > beadLeading.target();
  const t = now();
  beadLeading.set(x, forward ? SPRING.trail : SPRING.flag, t);
  beadTrailing.set(end, forward ? SPRING.flag : SPRING.trail, t);
  kick(renderBead);
};
const activateLink = (id, instant = false) => {
  activeIndex = id;
  let current;
  navLinks.forEach(link => {
    const on = link.hash === `#${id}`;
    if (on) current = link;
    if (on) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  placeBead(current, instant);
  if (current && navScroll) {
    const left = current.offsetLeft - navScroll.scrollLeft;
    const right = left + current.offsetWidth;
    const pad = 20;
    if (left < pad) navScroll.scrollBy({ left: left - pad, behavior: motionOK.matches ? "smooth" : "auto" });
    else if (right > navScroll.clientWidth - pad) navScroll.scrollBy({ left: right - navScroll.clientWidth + pad, behavior: motionOK.matches ? "smooth" : "auto" });
  }
};

const storyStops = $$('.story-flow [data-screen]');
const storyCards = storyStops.map(stop => stop.querySelector('.step-copy')).filter(Boolean);
const chapterHeads = $$('.story-flow .chapter-head');
const clearCardMotion = () => storyCards.forEach(card => {
  for (const property of ['--card-opacity', '--card-shift']) card.style.removeProperty(property);
});
// Cards crossfade as they pass through the reading area. They must disappear
// *before* entering the pinned chapter header; masking by card center alone
// allowed large, partly severed letters to show while scrolling backwards.
const paintCards = viewport => {
  if (root.dataset.cardMotion !== 'on') return;
  const readingLine = viewport * .69;
  const spread = Math.max(420, viewport * .78);
  storyCards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const delta = (rect.top + rect.bottom) / 2 - readingLine;
    const proximity = Math.max(0, Math.min(1, 1 - Math.abs(delta) / spread));
    const eased = proximity * proximity * (3 - 2 * proximity);
    const header = card.closest('.chapter')?.querySelector('.chapter-head');
    const headerEdge = header?.getBoundingClientRect().bottom ?? 0;
    const clearOfHeader = Math.max(0, Math.min(1, (rect.top - headerEdge - 32) / 90));
    card.style.setProperty('--card-opacity', ((.68 + .32 * eased) * clearOfHeader).toFixed(3));
    card.style.setProperty('--card-shift', `${((1 - eased) * (delta >= 0 ? 12 : -8)).toFixed(1)}px`);
  });
};
// As one sticky chapter makes way for the next, dissolve its heading before
// the exiting text can peek above the index. This follows the actual sticky
// position, so direct chapter jumps and reverse scrolls behave the same way.
const paintHeadings = () => {
  if (root.dataset.storyMode !== 'desktop') return;
  chapterHeads.forEach(head => {
    const opacity = Math.max(0, Math.min(1, (head.getBoundingClientRect().top - 70) / 80));
    head.style.setProperty('--heading-opacity', opacity.toFixed(3));
  });
};
const walkers = $$('main [data-walk]');
const toBand = element => {
  const rect = element.getBoundingClientRect();
  return { el: element, top: rect.top + scrollY, bottom: rect.bottom + scrollY };
};
let screenBands = [];
let walkBands = [];
const closestBand = (bands, y) => {
  let best;
  let distance = Infinity;
  let span = Infinity;
  for (const item of bands) {
    const d = y < item.top ? item.top - y : y > item.bottom ? y - item.bottom : 0;
    const itemSpan = item.bottom - item.top;
    // A chapter sits inside the larger surface section. Prefer the narrower
    // matching region, or its parent would win every scroll update.
    if (d < distance || (d === distance && itemSpan < span)) {
      best = item;
      distance = d;
      span = itemSpan;
    }
  }
  return best?.el;
};
let walkElement;
let pendingTarget = null;
let settleTimer = 0;
let queued = false;
const screenForTarget = target => {
  if (!target) return null;
  if (target.dataset.screen && screenIds.includes(target.dataset.screen)) return target.dataset.screen;
  const stop = target.closest(".chapter, .story-stop");
  return stop?.querySelector(".step[data-screen]")?.dataset.screen || stop?.dataset.screen || null;
};
const indexForTarget = target => {
  if (!target) return null;
  const indexed = target.closest("[data-index]");
  return indexed?.dataset.index || target.id || null;
};
const update = () => {
  queued = false;
  const viewport = innerHeight;
  paintCards(viewport);
  paintHeadings();
  const total = root.scrollHeight - viewport;
  const progress = total > 0 ? Math.min(1, Math.max(0, scrollY / total)) : 0;
  document.querySelector("[data-progress]")?.style.setProperty("transform", `scaleX(${progress.toFixed(4)})`);
  const y = progress >= .998 ? root.scrollHeight : scrollY + viewport * .5;
  const activeWalk = closestBand(walkBands, y);
  if (activeWalk && !pendingTarget) {
    const tone = walkTone(activeWalk);
    if (tone && displayTone(tone) !== root.dataset.tone) setTone(tone);
    if (activeWalk !== walkElement) {
      walkElement = activeWalk;
      const navId = activeWalk.dataset.index || activeWalk.id;
      if (navId) activateLink(navId, false);
    }
  }
  if (root.dataset.storyMode === "desktop" && !pendingTarget) {
    const activeScreen = closestBand(screenBands, y);
    if (activeScreen?.dataset.screen && activeScreen.dataset.screen !== screenId) setScreen(activeScreen.dataset.screen);
    storyStops.forEach(stop => stop.classList.toggle("is-active", stop === activeScreen));
  }
};
const schedule = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(update);
};
const measure = () => {
  walkBands = walkers.map(toBand);
  screenBands = storyMode.matches ? storyStops.map(toBand) : [];
  if (activeIndex) activateLink(activeIndex, true);
  schedule();
};
const releasePending = () => {
  clearTimeout(settleTimer);
  pendingTarget = null;
  schedule();
};

window.addEventListener("scroll", () => {
  if (pendingTarget) { clearTimeout(settleTimer); settleTimer = setTimeout(releasePending, 180); }
  schedule();
}, { passive: true });
document.addEventListener("click", event => {
  const link = event.target.closest?.('a[href^="#"]');
  if (!link || !link.hash || link.hash === "#") return;
  const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!target || !target.matches("main [data-walk], main [data-screen]")) return;
  // Keep native anchor scroll and focus behavior. Only synchronize the preview
  // and index immediately, so the phone does not tour every intermediate view.
  pendingTarget = target.id;
  const navId = indexForTarget(target);
  if (navId) activateLink(navId, false);
  const screen = screenForTarget(target);
  if (screen) setScreen(screen, true);
  const walk = target.closest("[data-walk]");
  if (walk) { walkElement = walk; setTone(walkTone(walk)); }
  clearTimeout(settleTimer);
  settleTimer = setTimeout(releasePending, 1300);
});
window.addEventListener("hashchange", () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  const navId = indexForTarget(target);
  if (navId) activateLink(navId, true);
  const screen = screenForTarget(target);
  if (screen) setScreen(screen, true);
  const walk = target.closest("[data-walk]");
  if (walk) { walkElement = walk; setTone(walkTone(walk)); }
  pendingTarget = id;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(releasePending, 1300);
  schedule();
});
for (const type of ["wheel", "touchstart", "keydown"]) {
  window.addEventListener(type, () => { if (pendingTarget) releasePending(); }, { passive: true });
}

// Responsive mode changes retain content in flow on compact/tall-narrow views.
const applyMode = () => {
  root.dataset.storyMode = storyMode.matches ? "desktop" : "inline";
  root.dataset.cardMotion = storyMode.matches && motionOK.matches ? "on" : "off";
  if (root.dataset.cardMotion === "off") clearCardMotion();
  if (!storyMode.matches) chapterHeads.forEach(head => head.style.removeProperty('--heading-opacity'));
  $$(".steps").forEach(strip => {
    if (storyMode.matches || strip.children.length < 2) strip.removeAttribute("tabindex");
    else strip.tabIndex = 0;
  });
  if (root.dataset.storyMode === "desktop") setScreen(screenId, true);
  else clearDeckStyles();
  measure();
};

// Gallery position is local to each strip and never moves the page.
for (const strip of $$(".steps")) {
  const output = strip.parentElement?.querySelector(".strip-at");
  if (!output) continue;
  let scrollQueued = false;
  strip.addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      const first = strip.firstElementChild;
      const gap = parseFloat(getComputedStyle(strip).columnGap || getComputedStyle(strip).gap || "0");
      const width = first ? first.getBoundingClientRect().width + gap : 1;
      output.textContent = String(Math.min(strip.children.length, Math.round(strip.scrollLeft / Math.max(width, 1)) + 1));
      scrollQueued = false;
    });
  }, { passive: true });
}

// iPad tabs: arrow keys, Home, and End; keyboard selections are immediate.
const tabLists = $$('[data-ipad-tabs]');
for (const list of tabLists) {
  const tabs = $$('[role="tab"]', list);
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute("aria-controls")));
  list.closest("[data-ipad-book]")?.classList.add("is-enhanced");
  const selectTab = (tab, focus = false) => {
    tabs.forEach((item, index) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      if (panels[index]) {
        panels[index].hidden = false;
        panels[index].classList.toggle("is-selected", selected);
        panels[index].setAttribute("aria-hidden", String(!selected));
        panels[index].inert = !selected;
      }
    });
    if (focus) tab.focus();
  };
  if (tabs[0]) selectTab(tabs[0]);
  list.hidden = false;
  list.addEventListener("click", event => {
    const tab = event.target.closest?.('[role="tab"]');
    if (tab && tabs.includes(tab)) selectTab(tab);
  });
  list.addEventListener("keydown", event => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[next], true);
  });
}

// The radio group works with keyboard and without script. Script also drives
// the six real paper captures and the page-wide daylight color.
const initialPhase = phaseInputs.find(input => input.checked)?.value || "dawn";
chosenPhase = initialPhase;
const setPhase = tone => {
  chosenPhase = tone;
  phaseInputs.forEach(input => { input.checked = input.value === tone; });
  refreshPhase(tone);
  setTone(tone);
};
phaseInputs.forEach(input => input.addEventListener("change", () => {
  phaseChosen = true;
  setPhase(input.value);
}));

// Ritual ledger: one tab stop, arrow-key grid navigation, and a live count.
for (const table of $$(".ledger table")) {
  const buttons = $$(".ledger-check", table);
  buttons.forEach((button, index) => { button.tabIndex = index === 0 ? 0 : -1; });
  table.addEventListener("keydown", event => {
    const button = event.target.closest?.(".ledger-check");
    if (!button) return;
    const rows = $$("tbody tr", table);
    let rowIndex = rows.indexOf(button.closest("tr"));
    let dayIndex = Number(button.dataset.day);
    const steps = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    const delta = steps[event.key];
    if (!delta) return;
    event.preventDefault();
    for (let n = 0; n < rows.length * 7; n++) {
      rowIndex = (rowIndex + delta[0] + rows.length) % rows.length;
      dayIndex = (dayIndex + delta[1] + 7) % 7;
      const next = rows[rowIndex].querySelector(`.ledger-check[data-day="${dayIndex}"]`);
      if (next) {
        button.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
        next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motionOK.matches ? "smooth" : "auto" });
        break;
      }
    }
  });
  table.addEventListener("click", event => {
    const button = event.target.closest?.(".ledger-check");
    if (!button) return;
    const pressed = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(pressed));
    const row = button.closest("tr");
    const output = row?.querySelector("output");
    const count = row?.querySelectorAll('.ledger-check[aria-pressed="true"]').length || 0;
    if (output) output.textContent = String(count);
    const status = document.querySelector("[data-ledger-status]");
    if (status) status.textContent = `${button.getAttribute("aria-label")}: ${pressed ? "kept" : "cleared"}. ${count} kept this week.`;
  });
}

// One-time image reveals only on compact strips, and only as they enter view.
if (motionOK.matches && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const element = entry.target;
    const rect = entry.boundingClientRect;
    if (rect.top > 0 && rect.top < innerHeight) {
      element.animate([
        { opacity: 0, transform: "translateY(9px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 340, easing: "cubic-bezier(.16, 1, .3, 1)" });
    }
    observer.unobserve(element);
  }), { rootMargin: "0px 0px -12% 0px" });
  $$(".step-shot, .ipad-figure, .daylight-figure, .chapter-head, .section-heading, .ipad-copy, .daylight-copy, .privacy-copy").forEach(element => observer.observe(element));
}

const stopMotion = () => {
  cancelAnimationFrame(frameId);
  animators.clear();
  ticking = false;
  deck.snap(deck.target());
  beadLeading.snap(beadLeading.target());
  beadTrailing.snap(beadTrailing.target());
  renderBead(now());
  clearDeckStyles();
  clearCardMotion();
  root.dataset.cardMotion = 'off';
  setScreen(screenId, true);
  document.querySelectorAll(".step-shot, .ipad-figure, .daylight-figure").forEach(element => {
    element.getAnimations?.().forEach(animation => animation.cancel());
  });
};
motionOK.addEventListener("change", () => {
  if (!motionOK.matches) stopMotion();
  else applyMode();
});
storyMode.addEventListener("change", applyMode);
window.addEventListener("resize", measure, { passive: true });
function applyCurrentTone() {
  const tone = walkElement ? walkTone(walkElement) : currentLogicalTone;
  setTone(tone);
}

// Resolve hash before revealing the sticky stage: direct links and browser
// history start on the requested screen without a Today flash.
const deepId = root.dataset.deepTarget;
const deepTarget = deepId ? document.getElementById(deepId) : null;
if (deepTarget) {
  const navId = indexForTarget(deepTarget);
  if (navId) activeIndex = navId;
  const walk = deepTarget.closest("[data-walk]");
  if (walk) { walkElement = walk; setTone(walkTone(walk)); }
  const initialScreen = screenForTarget(deepTarget);
  if (initialScreen) screenId = initialScreen;
}
applyMode();
if (!deepTarget) {
  const firstWalk = walkers[0];
  if (firstWalk) { walkElement = firstWalk; setTone(walkTone(firstWalk)); }
}
setScreen(screenId, true);
activateLink(activeIndex, true);
root.classList.add("js-ready");
measure();
document.fonts?.ready.then(measure);
