import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = ["/", "/privacy/", "/support/"];

// Scroll through the page so lazy images, sticky chapters, and the iPad tabs
// have all rendered before checking.
const walk = async page => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate(top => scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
};

for (const scheme of ["light", "dark"]) {
  for (const path of pages) {
    test(`${path} has no axe violations (${scheme})`, async ({ page }) => {
      // Reduced motion keeps every card at full opacity. With motion on, cards
      // fade while scrolling and axe would measure a card mid-fade.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(path);
      await walk(page);
      for (const top of [0, 0.25, 0.5, 0.75, 1]) {
        await page.evaluate(f => scrollTo(0, f * document.documentElement.scrollHeight), top);
        await page.waitForTimeout(150);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(", ")}`)).toEqual([]);
      }
    });
  }
}

for (const width of [390, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      await page.goto(path);
      await walk(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}

test("every page loads only from this site, and every link resolves", async ({ page, request }) => {
  const outside = [];
  page.on("request", r => { if (!r.url().startsWith("http://localhost:4400")) outside.push(r.url()); });
  const links = new Set();
  for (const path of pages) {
    await page.goto(path);
    await walk(page);
    for (const href of await page.$$eval("a[href]", as => as.map(a => a.href))) links.add(href.split("#")[0]);
  }
  expect(outside).toEqual([]);
  for (const link of links) {
    if (!link.startsWith("http://localhost:4400")) continue;
    expect((await request.get(link)).status(), link).toBe(200);
  }
});

test("unknown paths get the 404 page", async ({ page }) => {
  const response = await page.goto("/no-such-page/");
  expect(response.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("This page isn’t in the daybook.");
});

test("every page has sharing and search tags", async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]'), path).toHaveCount(1);
    for (const property of ["og:title", "og:description", "og:image", "og:url"]) {
      await expect(page.locator(`meta[property="${property}"]`), `${path} ${property}`).toHaveCount(1);
    }
  }
});

test("iPad tabs work from the keyboard", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "iPad pages" }).getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toBeFocused();
});

test("with Reduce Motion, nothing animates on scroll", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await walk(page);
  // The Reduce Motion styles shorten transitions to 0.01ms instead of removing
  // them, so only count animations long enough to see.
  const running = await page.evaluate(() => document.getAnimations()
    .filter(a => a.playState === "running" && Number(a.effect?.getTiming().duration) > 1).length);
  expect(running).toBe(0);
});
