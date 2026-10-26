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
  "Galactic Roulette", "Galactic Slot", "Dardos", "Billar", "Stack", "Tower Drop", "Orb Burst",
  "Shot Gallery", "Solitaire Sprint", "Mine Grid", "Stack Shift", "Pinball", "Galoku", "Bowling",
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
    await page.locator("#avatar-name").fill("Smoke");
    await page.getByText("CONTINUAR").click();
    await page.waitForTimeout(700);
    await page.getByText(name, { exact: true }).first().click({ timeout: 15000 });
    // An age confirmation, when present, is accepted; the current catalogue opens games directly.
    const confirm = page.getByTestId("age-confirm");
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const r = c && c.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        surface: !!c || !!document.querySelector(".mineGridGame, .solitaireGame, [class*='Game']"),
        canvasW: r ? Math.round(r.width) : 0,
        // Layout width of the page (device width on phones).
        layoutW: document.documentElement.clientWidth,
        scaled: !visualViewport || Math.abs(visualViewport.width - document.documentElement.clientWidth) < 2,
      };
    });
    if (m.overflow > 0) problems.push(`horizontal overflow ${m.overflow}px`);
    if (!m.surface) problems.push("no game surface rendered");
    if (m.canvasW && m.canvasW > m.layoutW + 1) problems.push(`canvas wider than viewport (${m.canvasW} > ${m.layoutW})`);
    if (!m.scaled) problems.push("layout not scaled to fit the screen");
  } catch (e) {
    problems.push("exception: " + String(e.message).split("\n")[0].slice(0, 160));
  }
  await ctx.close();
  return problems;
}

/** Resilience: blocked storage must not break onboarding; normal storage must persist the profile. */
async function checkStorage(browser) {
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "es-ES" });
  const blocked = await ctx.newPage();
  await ctx.addInitScript(() => {
    if (!window.__blockStorage) return;
    const deny = () => { throw new DOMException("denied", "SecurityError"); };
    Object.defineProperty(window, "localStorage", { get: deny });
    Object.defineProperty(window, "sessionStorage", { get: deny });
  });
  await blocked.addInitScript(() => { window.__blockStorage = true; });
  try {
    await blocked.goto(BASE + "/", { waitUntil: "networkidle" });
    await blocked.getByText("INICIAR SESIÓN").first().click({ timeout: 10000 });
    await blocked.locator("#avatar-name").fill("Sin");
    await blocked.getByText("CONTINUAR").click();
    await blocked.getByText("Dardos", { exact: true }).first().waitFor({ timeout: 10000 });
  } catch (e) {
    problems.push("blocked storage: " + String(e.message).split("\n")[0].slice(0, 120));
  }
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "es-ES" });
  const page = await ctx2.newPage();
  try {
    await page.goto(BASE + "/?reset=1", { waitUntil: "networkidle" });
    await page.getByText("INICIAR SESIÓN").first().click();
    await page.locator("#avatar-name").fill("Persiste");
    await page.getByText("CONTINUAR").click();
    await page.getByText("Dardos", { exact: true }).first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    const y = await page.evaluate(() => window.scrollY);
    if (y !== 0) problems.push("catalogue opens scrolled by " + y + "px after onboarding");
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.getByText("Dardos", { exact: true }).first().waitFor({ timeout: 10000 });
  } catch (e) {
    problems.push("profile not persisted: " + String(e.message).split("\n")[0].slice(0, 120));
  }
  await ctx2.close();
  return problems;
}

/** End to end: a real Tower Drop match must start, be replayed by the server and come back verified. */
async function checkVerifiedFlow(browser) {
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "es-ES" });
  const page = await ctx.newPage();
  const calls = [];
  page.on("response", async (r) => {
    if (!r.url().includes("/api/verified-match/")) return;
    let body = "";
    try { body = await r.text(); } catch {}
    calls.push({ path: new URL(r.url()).pathname, status: r.status(), body });
  });
  try {
    await page.goto(BASE + "/?reset=1", { waitUntil: "networkidle" });
    await page.getByText("INICIAR SESIÓN").first().click();
    await page.locator("#avatar-name").fill("E2E");
    await page.getByText("CONTINUAR").click();
    await page.getByText("Tower Drop", { exact: true }).first().click({ timeout: 15000 });
    await page.waitForTimeout(2500);
    const r = await page.$eval("canvas", (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    for (let i = 0; i < 14; i++) {
      await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
      await page.waitForTimeout(i < 2 ? 1500 : 900);
    }
    await page.waitForTimeout(6000);
    const start = calls.find((c) => c.path.endsWith("/start"));
    const verify = calls.find((c) => c.path.endsWith("/verify"));
    if (!start || start.status !== 200) problems.push("match did not start");
    else if (!verify) problems.push("no verification request was sent");
    else if (verify.status !== 200 || !/"verified":true/.test(verify.body)) problems.push("server did not verify the replay: " + verify.status + " " + verify.body.slice(0, 80));
  } catch (e) {
    problems.push("exception: " + String(e.message).split("\n")[0].slice(0, 120));
  }
  await ctx.close();
  return problems;
}

(async () => {
  const browser = await chromium.launch();
  const flow = await checkVerifiedFlow(browser);
  console.log((flow.length ? "FAIL " : "ok   ") + "verified match flow" + (flow.length ? " — " + flow.join("; ") : ""));
  const storage = await checkStorage(browser);
  console.log((storage.length ? "FAIL " : "ok   ") + "storage resilience" + (storage.length ? " — " + storage.join("; ") : ""));
  const queue = [...GAMES];
  const failures = [...(storage.length ? ["storage"] : []), ...(flow.length ? ["verified flow"] : [])];
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
