// Browser regression: terminal replay is sent immediately, while the explosion
// remains visible. Leaving its view cannot discard the record or publish a late result.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: process.env.QA_LANDSCAPE
      ? { width: 844, height: 390 }
      : { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  const cancel = Boolean(process.env.QA_CANCEL_FINALE);
  let verifyRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/verified-match/verify")) verifyRequests++;
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "skill-arena-v12",
      JSON.stringify({
        onboarded: true,
        playerName: "QA-Jet",
        balance: 25,
        netEarnings: 0,
        nextTurn: "create",
        musicOn: false,
        earnings: [{ label: "Inicio", value: 0 }],
        movements: [],
        wins: 0,
        losses: 0,
        streak: 0,
        group: null,
      }),
    );
    localStorage.setItem("skill-arena-color-tutorial-v12", "1");
  });
  if (cancel) await page.route("**/api/verified-match/verify", async route => {
    const response = await route.fetch();
    // A genuine server response arrives after leaving the terminal animation.
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.fulfill({ response });
  });
  await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
  await page.locator(".quickStakeBar button").first().tap();
  const start = page.waitForResponse((r) =>
    r.url().includes("/verified-match/start"),
  );
  await page
    .getByRole("button", { name: "Jugar a Jet Stream", exact: true })
    .tap();
  const manifest = await (await start).json();
  assert.equal(manifest.manifest.game_version, process.env.QA_GAME_VERSION || "3.0.0");
  await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
  await page.waitForTimeout(1200);
  const verification = page.waitForResponse((r) => r.url().includes("/verified-match/verify"));
  assert.equal(
    await page
      .locator(".coreHud")
      .innerText()
      .then((t) => t.includes("Jet Stream")),
    false,
  );
  await page.evaluate(() => {
    const hud = document.querySelector(".coreHud");
    window.__jetTerminalAt = null;
    const observer = new MutationObserver(() => {
      if (
        hud.textContent.includes("VIDAS 0") &&
        window.__jetTerminalAt === null
      ) {
        window.__jetTerminalAt = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(hud, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    const fetchOriginal = window.fetch;
    window.fetch = function (...args) {
      if (String(args[0]).includes("/verified-match/verify"))
        window.__jetVerifyAt = performance.now();
      return fetchOriginal.apply(this, args);
    };
  });
  await page.getByText("VIDAS 0", { exact: true }).waitFor();
  await page.waitForTimeout(180);

  assert.equal(await page.locator(".resultPanel").isVisible(), false);
  assert.equal(await page.locator(".verificationOverlay").isVisible(), false,
    "Verification must not cover the terminal explosion");
  assert.equal(verifyRequests, 1, "The record must be sent before the explosion ends");
  const submittedAt = await page.evaluate(() => window.__jetVerifyAt - window.__jetTerminalAt);
  assert.ok(Math.abs(submittedAt) < 250, `Terminal record delayed by ${submittedAt}ms`);
  if (cancel) {
    await page.getByRole("button", { name: "Volver", exact: true }).tap();
  }
  const response = await verification;
  const result = await response.json();
  assert.equal(result.verified, true);
  assert.equal(result.won, false);
  assert.equal(result.failure, "OUT_OF_BOUNDS");
  const body = response.request().postDataJSON();
  assert.equal(body.inputs.length, 0);
  assert.equal(body.manifest.match_id, manifest.manifest.match_id);
  assert.equal(result.time_ms, Math.round((body.final_tick * 1000) / 120));
  assert.equal(verifyRequests, 1);
  let explosionDuration = null;
  if (cancel) {
    assert.equal(await page.locator(".resultPanel").isVisible(), false,
      "A detached response must not finish a game on the catalogue");
    await page.getByRole("region", { name: "Catálogo de juegos" }).waitFor();
  } else {
    await page.locator(".resultPanel").waitFor();
    explosionDuration = await page.evaluate(() => performance.now() - window.__jetTerminalAt);
    assert.ok(explosionDuration >= 650, `Finale ended too soon at ${explosionDuration}ms`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cancelledDuringFinale: cancel, result, finalTick: body.final_tick,
    recordDelay: submittedAt, explosionDuration, verifyRequests, errors }));
  if (!cancel)
    await page.getByRole("button", { name: "CAMBIAR", exact: true }).tap();
  const restarted = page.waitForResponse((r) =>
    r.url().includes("/verified-match/start"),
  );
  await page
    .getByRole("button", { name: "Jugar a Jet Stream", exact: true })
    .tap();
  const next = await (await restarted).json();
  assert.notEqual(next.manifest.match_id, manifest.manifest.match_id);
  await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".resultPanel").isVisible(), false);
  assert.deepEqual(errors, []);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
