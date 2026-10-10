// Native mobile gesture, timing, complete fifteen darts and independent server replay.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
const { writeFileSync } = require("node:fs");
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
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
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
      window.__dartTrace = [];
      const fill = CanvasRenderingContext2D.prototype.fill;
      CanvasRenderingContext2D.prototype.fill = function (...args) {
        if (
          this.canvas.classList.contains("gameCanvas") &&
          this.fillStyle === "#dff7ff"
        ) {
          const m = this.getTransform(),
            trace = window.__dartTrace;
          trace.push({
            x: m.e,
            y: m.f,
            scale: Math.hypot(m.a, m.b),
            pixelWidth: this.canvas.width,
            pixelHeight: this.canvas.height,
          });
          if (trace.length > 300) trace.shift();
        }
        return fill.apply(this, args);
      };
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
    await page
      .getByRole("button", { name: "Entrenamiento gratis", exact: true })
      .tap();
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
    let submits = 0,
      firstFlight = null;
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
    const dpr = await page.evaluate(() =>
      Math.min(2, Math.max(1, devicePixelRatio || 1)),
    );
    const initialBox = await canvas.boundingBox();
    const firstScale = Math.min(
      initialBox.width / 390,
      initialBox.height / 620,
    );
    const firstOx = (initialBox.width - 390 * firstScale) / 2;
    const firstOy = (initialBox.height - 620 * firstScale) / 2;
    await page.waitForFunction(() => window.__dartTrace.length > 0);
    const prepared = await page.evaluate(() => window.__dartTrace.at(-1));
    // Native canvas matrices use float32; tolerate one milli-unit, not a wrong target.
    assert.ok(Math.abs((prepared.x / dpr - firstOx) / firstScale - 195) < 1e-3);
    assert.ok(
      Math.abs((prepared.y / dpr - firstOy) / firstScale - 550) < 1e-3,
      "dart visible in launch position before first throw",
    );
    for (const cancelMode of ["cancel", "blur"]) {
      const x = initialBox.x + firstOx + 195 * firstScale;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: initialBox.y + firstOy + 560 * firstScale }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: initialBox.y + firstOy + 285 * firstScale }],
      });
      if (cancelMode === "blur")
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancelMode === "cancel" ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
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
      if (i === 0) await page.evaluate(() => (window.__dartTrace = []));
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: tx, y: box.y + oy + 560 * scale }],
      });
      await page.waitForTimeout(45);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: tx, y: ty }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      if (i === 0) {
        await page.waitForTimeout(250);
        const trace = await page.evaluate(() => window.__dartTrace);
        firstFlight = trace.map((p) => ({
          x: (p.x / dpr - ox) / scale,
          y: (p.y / dpr - oy) / scale,
          scale: p.scale / dpr / scale,
        }));
        const moving = firstFlight.filter(
          (p) => p.scale < 1.3 && p.scale > 0.5,
        );
        assert.ok(moving.length >= 2, "visible real dart frames in flight");
        assert.ok(
          new Set(moving.map((p) => p.y.toFixed(3))).size >= 2,
          "dart tip visibly moves",
        );
        assert.ok(
          moving[0].scale > moving.at(-1).scale,
          "dart recedes into the board",
        );
        if (process.env.QA_FLIGHT_SCREENSHOT)
          await page.screenshot({ path: process.env.QA_FLIGHT_SCREENSHOT });
      }
      assert.equal(
        await page
          .getByRole("button", { name: "Lanzar dardo", exact: true })
          .count(),
        0,
      );
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
    const hit = replay.state.impacts[0];
    if (process.env.QA_REPLAY_PATH)
      writeFileSync(
        process.env.QA_REPLAY_PATH,
        JSON.stringify(
          {
            issued,
            payload: body,
            result,
            firstFlight,
            hit,
            dpr,
            initialBox,
            prepared,
          },
          null,
          2,
        ),
      );
    assert.ok(
      firstFlight.some(
        (p) =>
          Math.abs(p.x - (195 + hit.x / 1000)) < 1e-3 &&
          Math.abs(p.y - (285 + hit.y / 1000)) < 1e-3,
      ),
      "visible impact equals authoritative landing",
    );
    assert.equal(replay.state.impacts.length, 15);
    assert.equal(
      await page.locator(".coreHud strong").count(),
      0,
      "points absent from game HUD",
    );
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
    assert.notEqual(again.manifest.seed, issued.manifest.seed);
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.evaluate(() => (window.__dartTrace = []));
    await page.waitForFunction(() => window.__dartTrace.at(-1)?.scale > 0);
    const abandoning = page.waitForResponse((r) =>
      r.url().includes("/verified-match/verify"),
    );
    await page.getByRole("button", { name: "Volver", exact: true }).tap();
    const abandoned = await abandoning,
      receipt = await abandoned.json();
    assert.equal(abandoned.request().postDataJSON().record_kind, "abandoned");
    assert.equal(receipt.received, true);
    assert.equal(receipt.verified, false);
    assert.equal(submits, 2);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: process.env.QA_LANDSCAPE ? "landscape" : "portrait",
        verified: true,
        won: result.won,
        score: result.score,
        goals: replay.state.impacts.filter((i) => i.goal).length,
        finalTick: body.final_tick,
        preparedDart: true,
        flightAndImpact: true,
        restartAndReceipt: true,
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
