// Native touch QA over visible HUD and the public server-issued course.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href,
    { ORBIT_CORE: core, buildOrbitCourse } = await import(
      base + "lib/verified/orbitShiftCore.v1.js"
    ),
    { chooseOrbitAction } = await import(
      base + "scripts/orbit-play-fixture.js"
    ),
    { replayCore } = await import(base + "lib/verified/coreRuntime.v1.js");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = !!process.env.QA_LANDSCAPE,
      loss = !!process.env.QA_LOSS,
      context = await browser.newContext({
        viewport: landscape
          ? { width: 844, height: 390 }
          : { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_Orbit",
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
      window.__oscillators = 0;
      const tone = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...a) {
        window.__oscillators++;
        return tone.apply(this, a);
      };
    });
    let starts = 0,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3051");
    const started = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Orbit Shift", exact: true })
      .tap();
    const issued = await (await started).json();
    assert.equal(issued.manifest.game_version, "1.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    const controls = { IN: "Órbita interior", OUT: "Órbita exterior" },
      cdp = await context.newCDPSession(page);
    for (const b of await page.locator(".coreControls button").all()) {
      const r = await b.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44);
    }
    async function press(action) {
      const b = await page
        .getByRole("button", { name: controls[action], exact: true })
        .boundingBox();
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    const box = await page.locator("canvas.gameCanvas").boundingBox(),
      scale = Math.min(box.width / 390, box.height / 620),
      ox = (box.width - 390 * scale) / 2,
      oy = (box.height - 620 * scale) / 2,
      point = (y) => ({
        x: box.x + ox + 195 * scale,
        y: box.y + oy + y * scale,
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(460)],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(490)],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.waitForTimeout(200);
    await press("OUT");
    await page.waitForTimeout(200);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    const course = buildOrbitCourse(issued.manifest.seed);
    let done = false,
      lastSent = 0,
      screenshot = false;
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 180000 },
    );
    verified.then(() => (done = true)).catch(() => {});
    for (let turn = 0; !done && turn < 5000; turn++) {
      const text = await page.locator(".coreHud").innerText(),
        passed = Number(text.match(/(\d+)\/60/)[1]),
        lane = Number(text.match(/ÓRBITA (\d)/)[1]) - 1;
      if (!loss && passed < 60) {
        const a = chooseOrbitAction({ gates: course, passed, lane });
        if (a && Date.now() - lastSent >= 150) {
          if (done || (await page.locator(".resultPanel").isVisible())) break;
          await press(a);
          lastSent = Date.now();
        }
      }
      if (!screenshot && passed >= 22 && process.env.QA_SCREENSHOT) {
        await page.screenshot({ path: process.env.QA_SCREENSHOT });
        screenshot = true;
      }
      if (turn % 600 === 0) console.log("progress", text);
      await page.waitForTimeout(25);
    }
    const response = await verified,
      result = await response.json(),
      body = response.request().postDataJSON(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        issued.manifest.competition.target_score,
      );
    console.log(
      "result",
      JSON.stringify({
        result,
        passed: replay.state.passed,
        clean: replay.state.cleanPasses,
        pickups: replay.state.pickups,
        inputs: body.inputs.length,
      }),
    );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.won, !loss);
    if (loss) assert.equal(replay.failure, "ORBIT_COLLISION");
    else assert.equal(replay.state.passed, 60);
    assert.equal(starts, 1, "sound/blur do not reset");
    assert.equal(submits, 1);
    assert.ok(await page.evaluate(() => window.__oscillators > 0));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    const again = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const next = await (await again).json();
    assert.notEqual(next.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.setViewportSize(
      landscape ? { width: 320, height: 740 } : { width: 844, height: 390 },
    );
    for (const b of await page.locator(".coreControls button").all()) {
      const r = await b.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44);
    }
    assert.equal(starts, 2);
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: landscape ? "landscape" : "portrait",
        won: result.won,
        score: result.score,
        finalTick: body.final_tick,
        passed: replay.state.passed,
        lives: replay.state.lives,
        restart: true,
        orientationChange: true,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
