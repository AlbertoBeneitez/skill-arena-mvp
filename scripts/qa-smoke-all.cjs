/**
 * Mobile smoke test over the whole catalogue against a running production server.
 *   BASE_URL=http://127.0.0.1:3111 node scripts/qa-smoke-all.cjs
 * Needs Playwright resolvable (NODE_PATH or local install). For every game it logs
 * in with a throwaway local profile, opens the game at 390x844, waits, and fails on:
 * console errors, uncaught page errors, CSP violations, horizontal overflow, or a
 * game surface that never appears. Exit code 1 when any game fails.
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://127.0.0.1:3111";
const GAMES = [
  "Galactic Slot", "Dardos", "Billar", "Tower Drop", "Jet Stream", "Metro Shift", "Orbit Shift",
  "Solitaire Sprint", "Mine Grid", "Serpent", "Brick Relay", "Stack Shift", "Maze Rush",
  "Star Phalanx", "River Dash", "Orb Burst", "Stack", "Piano Rush", "Alien Dash", "Shot Gallery",
  "Sky Hop", "Galactic Birds", "Galactic Roulette",
];
const CONCURRENCY = Number(process.env.SMOKE_CONCURRENCY || 3);

async function check(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "es-ES" });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || /Content Security Policy|Refused to/i.test(t)) problems.push("console: " + t.slice(0, 200));
  });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message.slice(0, 200)));
  try {
    await page.goto(BASE + "/?reset=1", { waitUntil: "networkidle" });
    await page.getByText("INICIAR SESIÓN").first().click();
    await page.getByPlaceholder("Nombre de avatar").fill("Smoke");
    await page.getByText("CONTINUAR").click();
    await page.waitForTimeout(700);
    await page.getByText(name, { exact: true }).first().click({ timeout: 15000 });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const r = c && c.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        surface: !!c || !!document.querySelector(".mineGridGame, .solitaireGame, [class*='Game']"),
        canvasW: r ? Math.round(r.width) : 0,
      };
    });
    if (m.overflow > 0) problems.push(`horizontal overflow ${m.overflow}px`);
    if (!m.surface) problems.push("no game surface rendered");
    if (m.canvasW && m.canvasW > 391) problems.push(`canvas wider than viewport (${m.canvasW})`);
  } catch (e) {
    problems.push("exception: " + String(e.message).split("\n")[0].slice(0, 160));
  }
  await ctx.close();
  return problems;
}

(async () => {
  const browser = await chromium.launch();
  const queue = [...GAMES];
  const failures = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const name = queue.shift();
        const problems = await check(browser, name);
        console.log((problems.length ? "FAIL " : "ok   ") + name + (problems.length ? " — " + problems.join("; ") : ""));
        if (problems.length) failures.push(name);
      }
    }),
  );
  await browser.close();
  console.log(failures.length ? `\n${failures.length} game(s) failed` : `\nAll ${GAMES.length} games opened cleanly`);
  process.exit(failures.length ? 1 : 0);
})();
