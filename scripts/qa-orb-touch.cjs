// Native mobile touch regression, independently replayed and verified by the real server.
// Only local demo target is adjusted; the server-issued seed is never selected by this test.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const load = (p) =>
    import(pathToFileURL(path.join(__dirname, "../.det-test", p)).href);
  const {
    ORB_BURST_CORE: core,
    forecastOrb,
    orbDirection,
  } = await load("lib/verified/orbBurstCore.v1.js");
  const { replayCore } = await load("lib/verified/coreRuntime.v1.js");
  const { bestOrbAim } = await load("scripts/orb-play-fixture.js");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: process.env.QA_LANDSCAPE
        ? { width: 844, height: 390 }
        : { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
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
    let submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    await page.route("**/api/verified-match/start", (route) =>
      route.continue({
        postData: JSON.stringify({
          ...route.request().postDataJSON(),
          target_score: 840,
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
    const issued = await (await start).json(),
      seed = issued.manifest.seed;
    assert.equal(issued.manifest.game_version, "1.0.0");
    const state = core.create(seed),
      aim = bestOrbAim(state),
      expected = forecastOrb(state, aim).state.score;
    assert.ok(expected >= 840);
    const canvas = page.locator('canvas[aria-label^="Orb Burst."]');
    await canvas.waitFor();
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    const rect = await canvas.boundingBox(),
      scale = Math.min(rect.width / 390, rect.height / 620);
    const offsetX = rect.x + (rect.width - 390 * scale) / 2,
      offsetY = rect.y + (rect.height - 620 * scale) / 2;
    const d = orbDirection(aim),
      dy = Math.min(150, 185 * Math.abs(d.y / d.x || 1));
    const x = offsetX + (195 - (d.x / d.y) * dy) * scale,
      y = offsetY + (574 - dy) * scale;
    const cdp = await context.newCDPSession(page);
    // Cancellation must not launch; the next gesture must retain pointer ownership.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.waitForTimeout(80);
    await canvas.evaluate((c) => {
      window.__orbBaseline = c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height).data;
    });
    const verification = page.waitForResponse((r) =>
      r.url().includes("/verified-match/verify"),
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 2 }],
    });
    await page.waitForTimeout(30);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    // Stray pointer-up cannot shoot a second projectile.
    await canvas.dispatchEvent("pointerup", {
      pointerId: 777,
      clientX: x,
      clientY: y,
      pointerType: "touch",
    });
    await page.waitForTimeout(120);
    const changed = await canvas.evaluate((c) => {
      const old = window.__orbBaseline,
        next = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 0; i < next.length; i += 4)
        if (
          Math.abs(next[i] - old[i]) +
            Math.abs(next[i + 1] - old[i + 1]) +
            Math.abs(next[i + 2] - old[i + 2]) >
          130
        )
          count++;
      return count;
    });
    assert.ok(changed > 150, "Touch release must visibly launch a projectile");
    assert.equal(
      await page.locator(".resultPanel").isVisible(),
      false,
      "Flight must precede result",
    );
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Desactivar sonido", exact: true })
      .tap();
    if (process.env.QA_ARTIFACT_DIR)
      await page.screenshot({
        path: path.join(
          process.env.QA_ARTIFACT_DIR,
          `orb-flight-${process.env.QA_LANDSCAPE ? "landscape" : "portrait"}.png`,
        ),
      });
    const response = await verification,
      result = await response.json(),
      payload = response.request().postDataJSON();
    assert.equal(result.verified, true);
    assert.equal(result.won, true);
    assert.equal(result.authoritative_source, "SERVER_REPLAY");
    assert.equal(payload.inputs.filter((i) => i.action === "SHOOT").length, 1);
    assert.equal(submits, 1);
    const replay = replayCore(
      core,
      payload.inputs,
      payload.final_tick,
      seed,
      840,
    );
    assert.equal(replay.valid, true);
    assert.equal(result.score, replay.score);
    assert.equal(result.score, expected);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({ changed, result, inputs: payload.inputs, errors }),
    );
    await page.getByRole("button", { name: "OTRO JUEGO", exact: true }).click();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Orb Burst", exact: true })
      .click();
    const next = await (await restart).json();
    assert.notEqual(next.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
