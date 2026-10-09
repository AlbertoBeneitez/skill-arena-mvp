// Native mobile gesture, timing, complete fifteen darts and independent server replay.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const { DARTS_CORE_V2: core, dartsDrift } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/dartsCore.v2.js"),
      )
    ),
    { applyCoreInput, stepCore, replayCore } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/coreRuntime.v1.js"),
      )
    ),
    { dartsAimAction } = await import(
      pathToFileURL(
        path.join(__dirname, "../.det-test/lib/verified/dartsProtocol.v1.js"),
      )
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
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA-Dardos",
          balance: 25,
          netEarnings: 0,
          nextTurn: "create",
          musicOn: false,
          earnings: [],
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
        original(...args).then((r) => {
          if (String(args[0]).includes("/verified-match/start"))
            window.__issued = true;
          return r;
        });
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
    await page.locator(".quickStakeBar button").first().tap();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Dardos", exact: true })
      .tap();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "2.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForTimeout(150);
    const cdp = await context.newCDPSession(page),
      canvas = page.locator("canvas.gameCanvas"),
      state = core.create(issued.manifest.seed);
    let submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const response = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 90000 },
    );
    response.catch(() => {});
    async function touch(x, y, cancel = false, drag = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: x + (drag ? -12 : 0), y: y + (drag ? -8 : 0) }],
      });
      if (drag) {
        await page.waitForTimeout(45);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    const initialBox = await canvas.boundingBox();
    const firstScale = Math.min(initialBox.width/390, initialBox.height/620);
    const firstOx = (initialBox.width-390*firstScale)/2;
    const firstOy = (initialBox.height-620*firstScale)/2;
    for (const cancelMode of ['cancel','blur']) {
      const x=initialBox.x+firstOx+195*firstScale;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:initialBox.y+firstOy+560*firstScale}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:initialBox.y+firstOy+285*firstScale}]});
      if(cancelMode==='blur') await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      await cdp.send('Input.dispatchTouchEvent',{type:cancelMode==='cancel'?'touchCancel':'touchEnd',touchPoints:[]});
    }
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    for (let i = 0; i < 15; i++) {
      const tick = await page.evaluate(() =>
          Math.floor(((performance.now() - window.__epoch) * 120) / 1000),
        ),
        drift = dartsDrift(state, tick + 8),
        t = state.target,
        x = process.env.QA_LOSS
          ? 0
          : Math.max(0, Math.min(60, Math.round((t.x - drift.x) / 5000) + 30)),
        y = process.env.QA_LOSS
          ? 60
          : Math.max(0, Math.min(60, Math.round((t.y - drift.y) / 5000) + 30));
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox(),
        scale = Math.min(box.width / 390, box.height / 620),
        ox = (box.width - 390 * scale) / 2,
        oy = (box.height - 620 * scale) / 2;
      const tx = box.x + ox + (195 + (x - 30) * 5) * scale;
      const ty = box.y + oy + (285 + (y - 30) * 5) * scale;
      await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[{x:tx,y:box.y+oy+560*scale}]});
      await page.waitForTimeout(45);
      await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[{x:tx,y:ty}]});
      await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
      assert.equal(await page.getByRole("button", {name:"Lanzar dardo",exact:true}).count(),0);
      for (const a of [
        dartsAimAction("X", x),
        dartsAimAction("Y", y),
        "THROW",
      ]) {
        if (core.canApply(state, a)) applyCoreInput(core, state, a, 1000000);
      }
      for (let j = 0; j < 48; j++) core.step(state);
      if (i < 14) await page.waitForTimeout(600);
    }
    const vr = await response,
      body = vr.request().postDataJSON(),
      result = await vr.json(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        issued.manifest.competition.target_score,
      );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.won, !process.env.QA_LOSS);
    assert.equal(
      body.inputs.filter((i) => i.action === "THROW").length,
      15,
      "cancel and blur never add a dart",
    );
    assert.equal(submits, 1);
    assert.equal(replay.state.impacts.length, 15);
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > window.innerWidth),
      false,
    );
    await page.getByRole("button", { name: "CAMBIAR", exact: true }).tap();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Dardos", exact: true })
      .tap();
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
        goals: replay.state.impacts.filter((i) => i.goal).length,
        finalTick: body.final_tick,
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
