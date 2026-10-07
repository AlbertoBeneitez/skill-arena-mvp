// Real touch failure QA: deliberate missed shots, server-authoritative overflow.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict");
const { register } = require("node:module"),
  { pathToFileURL } = require("node:url");
const path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const {
    ORB_BURST_CORE: core,
    forecastOrb,
    orbDirection,
  } = await import(
    pathToFileURL(
      path.join(__dirname, "../.det-test/lib/verified/orbBurstCore.v1.js"),
    ).href
  );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA-Arena",
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
    await page.route("**/api/verified-match/start", (r) =>
      r.continue({
        postData: JSON.stringify({
          ...r.request().postDataJSON(),
          target_score: 1e9,
        }),
      }),
    );
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
    await page.locator(".quickStakeBar button").first().click();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Orb Burst", exact: true })
      .click();
    const issued = await (await start).json();
    let state = core.create(issued.manifest.seed);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    const c = page.locator('canvas[aria-label^="Orb Burst."]'),
      rect = await c.boundingBox(),
      scale = Math.min(rect.width / 390, rect.height / 620),
      ox = rect.x + (rect.width - 390 * scale) / 2,
      oy = rect.y + (rect.height - 620 * scale) / 2,
      cdp = await context.newCDPSession(page);
    const verification = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 180000 },
    );
    for (let n = 0; n < 80 && state.status === "running"; n++) {
      state.settleRemaining = 0;
      let aim = 44,
        worst = null,
        value = Infinity;
      for (let i = 0; i < 89; i++) {
        const f = forecastOrb(state, i).state,
          v = (f.score - state.score) * 1000 - (f.lastLanding?.row || 0);
        if (v < value) {
          value = v;
          aim = i;
          worst = f;
        }
      }
      const d = orbDirection(aim),
        dy = Math.min(150, 185 * Math.abs(d.y / d.x || 1)),
        x = ox + (195 - (d.x / d.y) * dy) * scale,
        y = oy + (574 - dy) * scale;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await page.waitForTimeout(15);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(((worst.tick - state.tick) * 1000) / 120 + 230);
      state = worst;
      if (await page.locator(".resultPanel").isVisible()) break;
    }
    const response = await verification,
      result = await response.json();
    assert.equal(result.verified, true);
    assert.equal(result.won, false);
    assert.ok(["BOARD_OVERFLOW", "BOARD_BLOCKED"].includes(result.failure));
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        result,
        inputs: response.request().postDataJSON().inputs.length,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
