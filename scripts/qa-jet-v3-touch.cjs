// Native mobile controls against server-issued seed/target; no arbitrary client scenario.
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
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href;
  const { JET_STREAM_CORE_V4: core } = await import(
      base + "lib/verified/jetStreamCore.v4.js"
    ),
    { shouldFlapJetV4 } = await import(base + "scripts/jet-v4-play-fixture.js"),
    { applyCoreInput, advanceCoreToTick, replayCore } = await import(
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
      window.__jetEvents = [];
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (event.target.matches?.("canvas.gameCanvas"))
            window.__jetEvents.push({ when: performance.now() });
        },
        true,
      );
      // Observe the actual rendered ship, forwarding every drawing call unchanged.
      const p = CanvasRenderingContext2D.prototype,
        clear = p.clearRect,
        fill = p.fillRect;
      window.__jetBodies = [];
      p.clearRect = function (...args) {
        if (this.canvas.classList.contains("gameCanvas"))
          window.__jetBodies = [];
        return clear.apply(this, args);
      };
      p.fillRect = function (x, y, w, h) {
        if (
          this.canvas.classList.contains("gameCanvas") &&
          w === 30 &&
          h > 3 &&
          this.fillStyle instanceof CanvasGradient
        ) {
          const m = this.getTransform();
          window.__jetBodies.push({
            x,
            top: m.f + m.d * y,
            bottom: m.f + m.d * (y + h),
            height: this.canvas.height,
          });
        }
        return fill.call(this, x, y, w, h);
      };
      const translate = CanvasRenderingContext2D.prototype.translate;
      CanvasRenderingContext2D.prototype.translate = function (x, y) {
        if (this.canvas.classList.contains("gameCanvas") && x === 92)
          window.__jetShip = {
            y: Math.round(y * 1000),
            when: performance.now(),
          };
        return translate.call(this, x, y);
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
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3034");
    await page
      .getByRole("button", { name: "Entrenamiento gratis", exact: true })
      .tap();
    const response = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Jet Stream", exact: true })
      .tap();
    const issued = await (await response).json();
    assert.equal(issued.manifest.game_version, "4.0.0");
    const target = issued.manifest.competition.target_score;
    const s = core.create(issued.manifest.seed);
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
    let eventIndex = 0,
      firstTap = true,
      lastDecision = -1,
      boundariesChecked = false;
    const loss = Boolean(process.env.QA_LOSS || process.env.QA_TAP_LOSS);
    async function syncPlayer() {
      const clock = await page.evaluate(() => ({
        epoch: window.__epoch,
        now: performance.now(),
        events: window.__jetEvents,
        ship: window.__jetShip,
      }));
      for (; eventIndex < clock.events.length; eventIndex++) {
        const tick = Math.max(
          0,
          Math.floor(
            ((clock.events[eventIndex].when - clock.epoch) * 120) / 1000,
          ),
        );
        advanceCoreToTick(core, s, tick, target);
        applyCoreInput(core, s, "FLAP", target);
      }
      if (clock.ship && clock.ship.when >= clock.epoch) {
        const visualTick = Math.max(
          0,
          Math.floor(((clock.ship.when - clock.epoch) * 120) / 1000),
        );
        advanceCoreToTick(core, s, visualTick, target);
        // This is the external test player's estimate, never browser game state.
        // Actual taps may differ by a tick from CDP transport; visual observation
        // prevents that estimate drifting across a three-minute native run.
        s.yMilli = clock.ship.y;
      }
      advanceCoreToTick(
        core,
        s,
        Math.floor(((clock.now - clock.epoch) * 120) / 1000),
        target,
      );
    }
    while (!finished) {
      if (process.env.QA_LOSS || (process.env.QA_TAP_LOSS && !firstTap)) break;
      await syncPlayer();
      if (!boundariesChecked) {
        const bodies = await page.evaluate(() => window.__jetBodies);
        const visible = bodies.filter((b) => b.x >= 180 && b.x <= 320);
        if (visible.length >= 2) {
          assert.ok(
            visible.some((b) => Math.abs(b.top) < 0.01),
            "gate body reaches physical canvas top",
          );
          assert.ok(
            visible.some((b) => Math.abs(b.bottom - b.height) < 0.01),
            "gate body reaches physical canvas bottom",
          );
          boundariesChecked = true;
          if (process.env.QA_GATE_SCREENSHOT)
            await page.screenshot({ path: process.env.QA_GATE_SCREENSHOT });
        }
      }
      if (s.status !== "running") break;
      if (s.tick !== lastDecision) {
        lastDecision = s.tick;
        if (shouldFlapJetV4(s)) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [point],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: firstTap ? "touchCancel" : "touchEnd",
            touchPoints: [],
          });
          if (firstTap) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [point],
            });
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          }
          if (firstTap && process.env.QA_GAMEPLAY_SCREENSHOT)
            await page.screenshot({ path: process.env.QA_GAMEPLAY_SCREENSHOT });
          firstTap = false;
        }
      }
      await page.waitForTimeout(20);
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
    if (process.env.QA_REPLAY_PATH)
      writeFileSync(
        process.env.QA_REPLAY_PATH,
        JSON.stringify(
          { issued, payload: body, result, boundariesChecked },
          null,
          2,
        ),
      );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.state.passed);
    assert.equal(result.time_ms, replay.timeMs);
    if (result.won !== !loss)
      console.log(
        JSON.stringify({
          failure: result.failure,
          finalTick: body.final_tick,
          firstActual: body.inputs[0]?.tick,
          inputs: body.inputs.length,
          reach: result.height,
        }),
      );
    assert.equal(result.won, !loss);
    assert.equal(submits, 1);
    if (!loss) {
      assert.equal(boundariesChecked, true);
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
    const resultText = await page.locator(".resultPanel").innerText();
    assert.ok(resultText.includes("Avance alcanzado"));
    assert.equal(resultText.includes("Puntos"), false);
    assert.equal(
      Number(
        await page
          .getByLabel("Avance del intento", { exact: true })
          .innerText(),
      ),
      replay.state.passed,
    );
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    await page.getByRole("button", { name: "CAMBIAR", exact: true }).tap();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Jet Stream", exact: true })
      .tap();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    await page.setViewportSize(
      process.env.QA_LANDSCAPE
        ? { width: 320, height: 720 }
        : { width: 844, height: 390 },
    );
    await page.evaluate(() =>
      window.dispatchEvent(new Event("orientationchange")),
    );
    await page.locator("canvas.gameCanvas").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: process.env.QA_LANDSCAPE ? "landscape" : "portrait",
        verified: true,
        boundariesChecked,
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
