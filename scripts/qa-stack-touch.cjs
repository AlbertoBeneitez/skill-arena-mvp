// Real touch fixtures exercise both axes and compare actual recorded inputs with server replay.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
register(
  pathToFileURL(require("node:path").join(__dirname, "determinism-loader.mjs")),
);
(async () => {
  const { STACK_3D_CORE: core } = await import(
    pathToFileURL(
      require("node:path").join(
        __dirname,
        "../.det-test/lib/verified/precisionStackCore.v3.js",
      ),
    ).href
  );
  const { applyCoreInput, stepCore, replayCore } = await import(
    pathToFileURL(
      require("node:path").join(
        __dirname,
        "../.det-test/lib/verified/coreRuntime.v1.js",
      ),
    ).href
  );
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
  const target = Number(process.env.QA_TARGET_SCORE || 4000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "skill-arena-v12",
      JSON.stringify({
        onboarded: true,
        playerName: "QA-Stack",
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
    const raf = requestAnimationFrame;
    window.requestAnimationFrame = (cb) => {
      if (window.__issued && !window.__epoch)
        window.__epoch = performance.now();
      return raf(cb);
    };
    const original = fetch;
    window.fetch = (...args) =>
      original(...args).then((response) => {
        if (String(args[0]).includes("/verified-match/start"))
          window.__issued = true;
        return response;
      });
  });
  await page.route("**/api/verified-match/start", (r) =>
    r.continue({
      postData: JSON.stringify({
        ...r.request().postDataJSON(),
        target_score: target,
      }),
    }),
  );
  await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
  await page.locator(".quickStakeBar button").first().click();
  const start = page.waitForResponse((r) =>
    r.url().includes("/verified-match/start"),
  );
  await page
    .getByRole("button", { name: "Jugar a Stack", exact: true })
    .click();
  const manifest = (await (await start).json()).manifest;
  assert.equal(manifest.game_version, "3.0.0");
  await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
  const epoch = await page.evaluate(() => window.__epoch);
  assert.ok(epoch);
  const state = core.create(manifest.seed);
  const planned = [];
  for (let n = 0; n < (target > 4000 ? 16 : 6); n++) {
    while (state.phase !== "moving")
      stepCore(core, state, Number.MAX_SAFE_INTEGER);
    while (state.movingAgeTicks < state.periodTicks / 4)
      stepCore(core, state, Number.MAX_SAFE_INTEGER);
    planned.push(state.tick);
    applyCoreInput(core, state, "DROP", Number.MAX_SAFE_INTEGER);
  }
  const cdp = await context.newCDPSession(page);
  let result = null;
  const verification = page
    .waitForResponse((r) => r.url().includes("/verified-match/verify"))
    .then(async (r) => {
      result = await r.json();
      return r;
    });
  for (let n = 0; n < planned.length && !result; n++) {
    const now = await page.evaluate(() => performance.now());
    await page.waitForTimeout(
      Math.max(0, epoch + (planned[n] * 1000) / 120 + 2 - now),
    );
    if (result) break;
    if (n < 2 || n === 9)
      await page.screenshot({
        path: require("node:path").join(
          process.env.QA_ARTIFACT_DIR || "/tmp",
          `stack-axis-${n}-${process.env.QA_LANDSCAPE ? "landscape" : "portrait"}.png`,
        ),
      });
    const box = await page.locator('canvas[role="application"]').boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  const response = await verification;
  assert.equal(result.verified, true);
  assert.equal(result.won, true);
  assert.ok(result.score >= target);
  const body = response.request().postDataJSON();
  const replay = replayCore(
    core,
    body.inputs,
    body.final_tick,
    manifest.seed,
    target,
  );
  assert.equal(replay.valid, true);
  assert.equal(replay.score, result.score);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result, inputs: body.inputs, errors }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
