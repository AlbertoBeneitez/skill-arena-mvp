// Native mobile game QA. Mirror uses the common core only to steer visible placements;
// final assertions replay the actual posted inputs, not the steering predictions.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const b = pathToFileURL(path.join(__dirname, "../.det-test/")).href,
    { METRO_CORE: core } = await import(
      b + "lib/verified/metroShiftCore.v1.js"
    ),
    { chooseMetroAction } = await import(b + "scripts/metro-play-fixture.js"),
    { advanceCoreToTick, applyCoreInput, replayCore } = await import(
      b + "lib/verified/coreRuntime.v1.js"
    );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = Boolean(process.env.QA_LANDSCAPE),
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
          playerName: "QA-Metro",
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
      window.__oscillators = 0;
      const oscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...a) {
        window.__oscillators++;
        return oscillator.apply(this, a);
      };
      const raf = requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        if (window.__issued && !window.__epoch)
          window.__epoch = performance.now();
        return raf(cb);
      };
      const f = fetch;
      window.fetch = (...a) =>
        f(...a).then((r) => {
          if (String(a[0]).includes("/verified-match/start"))
            window.__issued = true;
          return r;
        });
    });
    let starts = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3045");
    await page.locator(".quickStakeBar button").first().click();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Metro Shift", exact: true })
      .click();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "1.0.0");
    const s = core.create(issued.manifest.seed),
      target = issued.manifest.competition.target_score;
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.ok(
      (await page.locator(".coreHud").innerText()).includes("/60"),
      "physical HUD keeps progression readable",
    );
    if (process.env.QA_SOUND)
      await page
        .getByRole("button", { name: "Activar sonido", exact: true })
        .tap();
    const canvas = await page.locator("canvas.gameCanvas").boundingBox(),
      controls = await page.locator(".coreControls").boundingBox();
    assert.ok(
      landscape
        ? controls.x >= canvas.x + canvas.width
        : controls.y >= canvas.y + canvas.height,
      "controls must not hide the board/floor",
    );
    const cdp = await context.newCDPSession(page),
      points = {};
    const names = {
      LEFT: "Cambiar carril izquierda",
      RIGHT: "Cambiar carril derecha",
      JUMP: "Saltar valla",
    };
    for (const [a, name] of Object.entries(names)) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      points[a] = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    let done = false,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 240000 },
    );
    verified
      .then(() => {
        done = true;
      })
      .catch(() => {});
    async function sync() {
      const tick = await page.evaluate(() =>
        Math.floor(((performance.now() - window.__epoch) * 120) / 1000),
      );
      advanceCoreToTick(core, s, tick, target);
    }
    async function tap(a, cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [points[a]],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    // Swipes act while dragging; cancel stops the gesture without undoing accepted input.
    const scale = Math.min(canvas.width / 390, canvas.height / 620),
      ox = (canvas.width - 390 * scale) / 2,
      oy = (canvas.height - 620 * scale) / 2;
    const cp = {
      x: canvas.x + ox + 195 * scale,
      y: canvas.y + oy + 440 * scale,
    };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [cp],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...cp, x: cp.x + 70 * scale }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await sync();
    applyCoreInput(core, s, "RIGHT", target);
    await page.waitForTimeout(210);
    await tap("LEFT");
    await sync();
    applyCoreInput(core, s, "LEFT", target);

    let doubleTested = false,
      screenshotTaken = false;
    for (let turns = 0; !done && turns < 6000; turns++) {
      await sync();
      if (s.status !== "running") break;
      const a = process.env.QA_LOSS ? null : chooseMetroAction(s);
      if (a && core.canApply(s, a)) {
        await tap(a);
        await sync();
        if (core.canApply(s, a)) applyCoreInput(core, s, a, target);
        if (!doubleTested) {
          await tap(a);
          doubleTested = true;
        }
        await page.waitForTimeout(145);
      } else await page.waitForTimeout(30);
      if (turns % 200 === 0)
        console.log(
          "progress",
          s.passed,
          await page.locator(".coreHud").innerText(),
        );
      if (!screenshotTaken && s.passed > 22 && process.env.QA_SCREENSHOT) {
        await page.screenshot({ path: process.env.QA_SCREENSHOT });
        screenshotTaken = true;
      }
    }
    const vr = await verified,
      body = vr.request().postDataJSON(),
      result = await vr.json(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        target,
      );
    console.log(
      "result",
      JSON.stringify({
        result,
        inputs: body.inputs.slice(0, 8),
        passed: replay.state.passed,
      }),
    );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.won, !process.env.QA_LOSS);
    assert.equal(submits, 1);
    assert.deepEqual(
      body.inputs.slice(0, 2).map((i) => i.action),
      ["RIGHT", "LEFT"],
      "cancel records no extra movement on release",
    );
    if (process.env.QA_LOSS) assert.equal(replay.failure, "HULL_EXHAUSTED");
    else {
      assert.ok(doubleTested);
      assert.equal(replay.state.passed, 60);
      assert.ok(body.inputs.some((i) => i.action === "JUMP"));
      assert.ok(replay.state.groups.some((g) => g.collected));
    }
    assert.ok(
      body.inputs.every((i, n) => n === 0 || i.tick > body.inputs[n - 1].tick),
    );
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    await page.getByRole("button", { name: "CAMBIAR", exact: true }).click();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Metro Shift", exact: true })
      .click();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    await page.setViewportSize(
      landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
    );
    assert.equal(
      starts,
      2,
      "orientation change cannot issue/restart an attempt",
    );
    for (const control of await page.locator(".coreControls button").all()) {
      const box = await control.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
    }
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );

    if (process.env.QA_SOUND)
      assert.ok(
        (await page.evaluate(() => window.__oscillators)) > 0,
        "native touch unlocks audio feedback",
      );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: landscape ? "landscape" : "portrait",
        verified: true,
        won: result.won,
        score: result.score,
        finalTick: body.final_tick,
        groups: replay.state.passed,
        lives: replay.state.lives,
        inputs: body.inputs.length,
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
