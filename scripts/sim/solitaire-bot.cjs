/**
 * Bot simulator · Solitaire Sprint, played in a real browser by tapping cards like a person (the game runs entirely
 * in the browser today: verification "client-result", no server replay). Strategy: waste → foundation/tableau,
 * then any face-up card that has a highlighted destination (foundations first), else draw from the stock.
 *   SIM_AUTH_SECRET=… node scripts/sim/solitaire-bot.cjs [bots=3]
 */
const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");

const BASE = process.env.SIM_BASE || "http://127.0.0.1:3200";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error("SIM_BASE must be local");
const SECRET = process.env.SIM_AUTH_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error("SIM_AUTH_SECRET required");
const BOTS = Number(process.argv[2] || 3);
const run = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const dir = `sim-reports/solitaire-${run}`;
fs.mkdirSync(dir, { recursive: true });
const mint = (sub, n) => { const now = Math.floor(Date.now() / 1000); const body = Buffer.from(JSON.stringify({ p: "google", sub, n, iat: now, exp: now + 3600 })).toString("base64url"); return `${body}.${crypto.createHmac("sha256", SECRET).update(body).digest("base64url")}`; };

// A tap through the DOM: cards overlap in a column, so a pointer-position click can land on the wrong card.
const tap = (loc) => loc.evaluate((el) => el.click()).catch(() => {});

async function tryMoveFrom(page, source, allowTableau = true) {
  await tap(source);
  await page.waitForTimeout(60);
  const dests = page.locator(".validDestination");
  const n = await dests.count();
  if (!n) { await tap(source); await page.waitForTimeout(40); return false; } // deselect
  // Foundations first, then the first tableau column.
  let target = null;
  for (let i = 0; i < n; i++) { const d = dests.nth(i); if (((await d.getAttribute("data-solitaire-destination")) || "").startsWith("foundation")) { target = d; break; } }
  if (!target && !allowTableau) { await tap(source); await page.waitForTimeout(40); return false; }
  target = target || dests.first();
  const id = (await target.getAttribute("data-solitaire-destination")) || "";
  if (id.startsWith("tableau")) {
    const last = target.locator("button.solitaireCard").last();
    if (await last.count()) await tap(last); else await tap(target);
  } else await tap(target);
  await page.waitForTimeout(200 + Math.random() * 250);
  return true;
}

async function bot(i, browser) {
  const name = `Bot Solit ${run.slice(-4)}${i}`.slice(0, 18);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-ES" });
  await ctx.addCookies([{ name: "ga_session", value: mint(`bot-sol-${run}-${i}`, name), url: BASE }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`página: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`consola: ${m.text().slice(0, 160)}`); });
  await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(2500);
  const nameInput = page.locator("#avatar-name");
  if (await nameInput.isVisible().catch(() => false)) { await nameInput.fill(name); await page.getByRole("button", { name: /continuar/i }).first().click().catch(() => {}); await page.waitForTimeout(1500); }
  await page.getByRole("button", { name: /^entrar$/i }).first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(1200);
  const card = page.locator("article").filter({ hasText: /Solitaire/i }).first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.locator("button").last().click({ timeout: 4000 }).catch((e) => errors.push(`abrir: ${e.message.slice(0, 80)}`));
  await page.locator(".solitaireTableau").waitFor({ timeout: 10000 }).catch(() => errors.push("el tablero no aparece"));
  const t0 = Date.now(); let moves = 0, draws = 0, idleDraws = 0;
  while (Date.now() - t0 < 330_000) {
    if (await page.locator('[aria-label="Resumen del intento"]').count()) break;
    let moved = false;
    const waste = page.locator("[data-solitaire-waste]");
    if (((await waste.innerText().catch(() => "")) || "").trim()) moved = await tryMoveFrom(page, waste);
    if (!moved) {
      // Only useful moves, like a person: the top card of a column (to a foundation), or the first face-up card of a
      // column when it frees a hidden card or empties the column (not a king already at the bottom).
      const columns = page.locator(".solitaireTableau .solitaireColumn");
      const cols = await columns.count();
      for (let c = 0; c < cols && !moved; c++) {
        const cards = columns.nth(c).locator("button.solitaireCard");
        const n = await cards.count();
        if (!n) continue;
        const classes = await cards.evaluateAll((els) => els.map((e) => e.className));
        const firstUp = classes.findIndex((k) => k.includes("faceUp"));
        if (firstUp < 0) continue;
        moved = await tryMoveFrom(page, cards.nth(n - 1), n - 1 === firstUp);
        const kingAtBottom = firstUp === 0 && /^K/.test(((await cards.nth(0).innerText().catch(() => "")) || "").trim());
        if (!moved && firstUp !== n - 1 && !kingAtBottom) moved = await tryMoveFrom(page, cards.nth(firstUp), true);
      }
    }
    if (moved) { moves++; idleDraws = 0; continue; }
    await tap(page.locator(".solitairePile.stock"));
    draws++; idleDraws++;
    await page.waitForTimeout(150 + Math.random() * 200);
    if (idleDraws > 60) break; // three passes through the stock without a move: stuck, like a person giving up
  }
  await page.waitForTimeout(2000);
  const summary = (await page.locator('[aria-label="Resumen del intento"]').innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
  await page.screenshot({ path: `${dir}/${i}.png` });
  await ctx.close();
  return { name, moves, draws, seconds: Math.round((Date.now() - t0) / 1000), finished: !!summary, summary, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const results = await Promise.all(Array.from({ length: BOTS }, (_, i) => bot(i + 1, browser).catch((e) => ({ name: `bot ${i + 1}`, error: e.message }))));
  await browser.close();
  fs.writeFileSync(`${dir}/report.json`, JSON.stringify(results, null, 2));
  for (const r of results) console.log(`- ${r.name}: ${r.moves ?? 0} jugadas, ${r.draws ?? 0} robos, ${r.seconds ?? 0} s, ${r.finished ? "terminada: " + r.summary : "sin terminar"}${r.errors?.length ? " · errores: " + r.errors.join(" | ") : ""}${r.error ? " · fallo: " + r.error : ""}`);
})();
