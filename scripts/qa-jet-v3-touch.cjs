// Native mobile controls against server-issued seed/target; no arbitrary client scenario.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href;
  const { JET_STREAM_CORE_V3: core } = await import(
      base + "lib/verified/jetStreamCore.v3.js"
    ),
    { shouldFlapJet } = await import(base + "scripts/jet-v3-play-fixture.js"),
    { applyCoreInput, stepCore, replayCore } = await import(
      base + "lib/verified/coreRuntime.v1.js"
    );
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
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3034");
    await page.locator(".quickStakeBar button").first().click();
    const response = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Jet Stream", exact: true })
      .click();
    const issued = await (await response).json();
    assert.equal(issued.manifest.game_version, "3.0.0");
    const target = issued.manifest.competition.target_score;
    const s = core.create(issued.manifest.seed),
      inputs = [];
    while (s.status === "running") {
      if (shouldFlapJet(s)) {
        inputs.push(s.tick);
        applyCoreInput(core, s, "FLAP", target);
      }
      stepCore(core, s, target);
    }
    assert.equal(s.status, "won");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.equal(
      (await page.locator(".coreHud").innerText()).includes("Jet Stream"),
      false,
    );
    const cdp = await context.newCDPSession(page),
      box = await page.locator("canvas.gameCanvas").boundingBox(),
      point = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.7 };
    let finished = false,
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
        finished = true;
      })
      .catch(() => {});
    // A cancelled gesture releases capture; the actual tap still owns its FLAP.
    if (!process.env.QA_LOSS)
      for (const tick of process.env.QA_TAP_LOSS
        ? inputs.slice(0, 1)
        : inputs) {
        if (finished) break;
        await page.waitForFunction(
          (t) =>
            window.__epoch &&
            performance.now() - window.__epoch >= (t * 1000) / 120,
          tick,
          { polling: 4, timeout: 15000 },
        );
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [point],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: tick === inputs[0] ? "touchCancel" : "touchEnd",
          touchPoints: [],
        });
        if (tick === inputs[0]) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [point],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
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
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    const loss = Boolean(process.env.QA_LOSS || process.env.QA_TAP_LOSS);
    assert.equal(result.won, !loss);
    assert.equal(submits, 1);
    if (!loss) {
      assert.ok(replay.state.passed > 50);
      assert.ok(replay.state.collected > 5);
    } else {
      assert.ok(body.final_tick > (process.env.QA_TAP_LOSS ? 360 : 720));
      if (process.env.QA_TAP_LOSS)
        assert.equal(
          body.inputs.length,
          1,
          "cancel + double tap cannot bypass FLAP cooldown",
        );
      assert.equal(replay.state.lives, 0);
    }
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    await page.getByRole("button", { name: "OTRO JUEGO", exact: true }).click();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Jet Stream", exact: true })
      .click();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: process.env.QA_LANDSCAPE ? "landscape" : "portrait",
        verified: true,
        won: result.won,
        score: result.score,
        finalTick: body.final_tick,
        portals: replay.state.passed,
        lives: replay.state.lives,
        pickups: replay.state.collected,
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
