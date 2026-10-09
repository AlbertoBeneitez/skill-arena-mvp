// Presentation integration: real issued attempts, native touch exits and actual
// server receipts across the registry. Full game-specific runs live separately.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core");
const assert = require("node:assert/strict");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { GAMES } = await import(pathToFileURL(path.join(__dirname, "../.det-test/lib/games.js")));
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  try {
    const landscape = !!process.env.QA_LANDSCAPE;
    const context = await browser.newContext({
      viewport: landscape ? { width: 844, height: 390 } : { width: 390, height: 844 },
      isMobile: true, hasTouch: true,
    });
    const page = await context.newPage(), errors = [], receipts = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await page.addInitScript(() => localStorage.setItem("skill-arena-v12", JSON.stringify({
      onboarded: true, playerName: "QA_CatalogRecords", balance: 25, netEarnings: 0,
      nextTurn: "create", musicOn: false, earnings: [{ label: "Inicio", value: 0 }],
      movements: [], wins: 0, losses: 0, streak: 0, group: null,
    })));
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3067");
    const catalog = page.getByRole("region", { name: "Catálogo de juegos" });
    await catalog.waitFor();
    for (const game of GAMES.filter(g => g.status === "VERIFIED")) {
      const start = page.waitForResponse(r => r.url().includes("/verified-match/start"));
      const action = page.getByRole("button", { name: `Jugar a ${game.name}`, exact: true });
      assert.equal((await action.innerText()).trim(), game.name);
      await action.tap();
      const issued = await (await start).json();
      assert.equal(issued.ok, true);
      assert.equal(issued.manifest.game_version, game.version);
      await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
      await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
      await page.locator("canvas.gameCanvas").waitFor();
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(await page.locator(".coreHint, .tutorialOverlay").count(), 0);
      const verify = page.waitForResponse(r => r.url().includes("/verified-match/verify"));
      await page.getByRole("button", { name: "Volver", exact: true }).tap();
      const response = await verify, payload = response.request().postDataJSON(), receipt = await response.json();
      assert.equal(response.status(), 200);
      assert.equal(payload.record_kind, "abandoned");
      assert.equal(payload.ticket.attempt_id, issued.ticket.attempt_id);
      assert.deepEqual(payload.manifest, issued.manifest);
      assert.equal(receipt.received, true);
      assert.equal(receipt.verified, false);
      assert.equal(receipt.durable, false);
      assert.equal(receipt.final_tick, payload.final_tick);
      receipts.push({ game: game.id, version: game.version, tick: receipt.final_tick });
      await catalog.waitFor();
    }
    assert.equal(receipts.length, GAMES.filter(g => g.status === "VERIFIED").length);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, landscape, receipts, errors }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
