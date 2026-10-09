// Real touch controls and issued practice manifest; no clock/target/seed overrides.
// External core plans legal gestures; forwarded canvas calls only synchronize dispatch.
// Server replay of the actual posted record is the final authority.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { Worker } = require("node:worker_threads"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href;
  const { ALIEN_DASH_CORE_V3: core } = await import(
      base + "lib/verified/alienDashCore.v3.js"
    ),
    { replayCore } = await import(base + "lib/verified/coreRuntime.v1.js");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = Boolean(process.env.QA_LANDSCAPE),
      loss = Boolean(process.env.QA_LOSS);
    const context = await browser.newContext({
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
          playerName: "QA-Alien3",
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
      window.__alienEvents = [];
      window.__alienFrame = { when: 0 };
      const held = new Map(),
        push = (action) =>
          window.__alienEvents.push({ action, when: performance.now() });
      const releaseAll = () => {
        for (const action of held.values()) push(action);
        held.clear();
      };
      const actions = { Saltar: "JUMP", "Mantener agachado": "DUCK_DOWN" };
      document.addEventListener(
        "pointerdown",
        (e) => {
          const button = e.target.closest?.(".coreControls button"),
            action =
              actions[button?.getAttribute("aria-label")] ||
              (e.target.matches?.("canvas.gameCanvas") ? "JUMP" : null);
          if (action) {
            push(action);
            if (action === "DUCK_DOWN") held.set(e.pointerId, "DUCK_UP");
          }
        },
        true,
      );
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        document.addEventListener(
          event,
          (e) => {
            const action = held.get(e.pointerId);
            if (action) {
              held.delete(e.pointerId);
              push(action);
            }
          },
          true,
        );
      window.addEventListener("blur", releaseAll, true);
      document.addEventListener(
        "focusout",
        (e) => {
          if (e.target.matches?.("canvas.gameCanvas,.coreControls button"))
            releaseAll();
        },
        true,
      );
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.classList?.contains("gameCanvas"))
          window.__alienFrame = { when: performance.now() };
        return clear.apply(this, args);
      };
      const move = CanvasRenderingContext2D.prototype.moveTo;
      CanvasRenderingContext2D.prototype.moveTo = function (x, y) {
        if (
          this.canvas.classList?.contains("gameCanvas") &&
          y === 514 &&
          this.strokeStyle.replace(/\s/g, "") === "rgba(140,195,219,0.17)" &&
          window.__alienFrame.deckPhase === undefined
        ) {
          const phase = Math.round(((((-x - 50) % 500) + 500) % 500) * 1000);
          window.__alienFrame.deckPhase = phase;
          if (phase > 0 && !window.__alienFirstScrollFrame)
            window.__alienFirstScrollFrame = {
              when: window.__alienFrame.when,
              phase,
            };
        }
        return move.call(this, x, y);
      };
      const text = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
        const timer = /^(\d+) s \/ 120 s$/.exec(String(value));
        if (this.canvas.classList?.contains("gameCanvas") && timer)
          window.__alienFrame.second = Number(timer[1]);
        return text.call(this, value, ...args);
      };
      const ellipse = CanvasRenderingContext2D.prototype.ellipse;
      CanvasRenderingContext2D.prototype.ellipse = function (
        x,
        y,
        rx,
        ry,
        ...args
      ) {
        if (this.canvas.classList?.contains("gameCanvas")) {
          if (
            this.fillStyle === "#a6e2c3" &&
            x === 89 &&
            rx === 18 &&
            (ry === 10 || ry === 15)
          )
            window.__alienFrame.player = {
              feet: Math.round((y - 13 + (ry === 10 ? 29 : 46)) * 1000),
              duck: ry === 10,
              when: performance.now(),
            };
        }
        return ellipse.call(this, x, y, rx, ry, ...args);
      };
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3081");
    await page.locator(".quickStakeBar button").first().tap();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Alien Dash", exact: true })
      .tap();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "3.0.0");
    const target = issued.manifest.competition.target_score;
    // The worker derives a complete legal route through the unchanged core.
    // It leaves native touch setup responsive while the countdown runs. Nothing
    // in this worker can access or mutate the browser simulation or its clock.
    const planner = new Worker(
      `
      const { parentPort, workerData } = require("node:worker_threads");
      const { register } = require("node:module");
      const { pathToFileURL } = require("node:url");
      register(pathToFileURL(workerData.loader));
      (async () => {
        const { ALIEN_DASH_CORE_V3: core } = await import(workerData.base + "lib/verified/alienDashCore.v3.js");
        const { chooseAlienActionV3 } = await import(workerData.base + "scripts/alien-v3-play-fixture.js");
        const { applyCoreInput, stepCore } = await import(workerData.base + "lib/verified/coreRuntime.v1.js");
        const state = core.create(workerData.seed), plan = [], scrollTicks = [0];
        while (state.status === "running") {
          const action = chooseAlienActionV3(state);
          if (action && core.canApply(state, action)) {
            plan.push({ tick: state.tick, action });
            applyCoreInput(core, state, action, workerData.target);
          }
          stepCore(core, state, workerData.target);
          scrollTicks.push(state.scroll);
        }
        parentPort.postMessage({ plan, scrollTicks, state });
      })().catch(error => { throw error; });
    `,
      {
        eval: true,
        workerData: {
          base,
          loader: path.join(__dirname, "determinism-loader.mjs"),
          seed: issued.manifest.seed,
          target,
        },
      },
    );
    const planned = new Promise((resolve, reject) => {
      planner.once("message", resolve);
      planner.once("error", reject);
      planner.once("exit", (code) => {
        if (code !== 0) reject(new Error(`Alien QA planner exit ${code}`));
      });
    });
    let plan, scrollTicks, plannedState;
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    const hud = await page.locator(".coreHud").innerText();
    assert.ok(hud.includes("AVANCE"));
    assert.equal(await page.locator(".coreHud strong").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Mantener agachado", exact: true })
        .innerText(),
      "↓",
    );
    const cdp = await context.newCDPSession(page),
      centers = new Map();
    async function center(name) {
      if (!centers.has(name)) {
        const b = page.getByRole("button", { name, exact: true });
        const box = await b.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44);
        centers.set(name, {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        });
      }
      return centers.get(name);
    }
    async function down(name) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [await center(name)],
      });
    }
    async function up(cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    let finished = false,
      submits = 0,
      held = false,
      epoch = null,
      clockCorrections = 0,
      progressCaptured = false,
      planIndex = 0,
      observedTick = 0;
    const decisionTrace = [];
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 190000 },
    );
    verified
      .then(() => {
        finished = true;
      })
      .catch(() => {});
    // Real canvas double-tap/cancel: only the first jump can be accepted in air.
    const canvasBox = await page.locator("canvas.gameCanvas").boundingBox(),
      canvasPoint = {
        x: canvasBox.x + canvasBox.width * 0.5,
        y: canvasBox.y + canvasBox.height * 0.4,
      };
    for (let tap = 0; tap < 2; tap++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [canvasPoint],
      });
      await up(tap === 0);
    }
    await down("Mantener agachado");
    await page.waitForTimeout(75);
    await up(true);
    await page.waitForTimeout(75);
    await down("Mantener agachado");
    await page.waitForTimeout(75);
    // Move focus away from the genuinely focused canvas while duck is held.
    await page.locator(".gameSoundToggle").focus();
    await up();
    await page.waitForTimeout(75);
    if (process.env.QA_GAMEPLAY_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_GAMEPLAY_SCREENSHOT });
    ({ plan, scrollTicks, state: plannedState } = await planned);
    assert.equal(plannedState.status, "won", "Issued course is fully playable");
    assert.equal(plannedState.tick, 14400);
    async function observeClock() {
      const observed = await page.evaluate(() => ({
        first: window.__alienFirstScrollFrame,
        now: performance.now(),
        frame: window.__alienFrame,
      }));
      assert.ok(observed.first, "Observed the unchanged game's moving deck");
      assert.ok(
        Number.isInteger(observed.frame.second),
        "Observed the rendered timer",
      );
      const firstTick = Math.min(14400, observed.frame.second * 120),
        lastTick = Math.min(14400, firstTick + 119);
      let frameTick = firstTick,
        smallestError = Infinity;
      // One displayed second spans under 240 px, shorter than the 500 px deck
      // repeat. Timer + deck phase therefore locate the actual rendered tick
      // uniquely, with no countdown epoch or repeated obstacle matching.
      for (let tick = firstTick; tick <= lastTick; tick++) {
        const error = Math.abs(
          (scrollTicks[tick] % 500000) - observed.frame.deckPhase,
        );
        if (error < smallestError) {
          smallestError = error;
          frameTick = tick;
        }
      }
      assert.ok(
        smallestError <= 1,
        `Rendered scroll phase agrees with core: ${smallestError}`,
      );
      epoch = observed.frame.when - (frameTick * 1000) / 120;
      clockCorrections++;
      observedTick = Math.min(
        14400,
        Math.max(0, Math.floor(((observed.now - epoch) * 120) / 1000)),
      );
      return observed;
    }
    while (!finished && !loss && observedTick < 14400) {
      const observed = await observeClock();
      if (
        !progressCaptured &&
        process.env.QA_PROGRESS_SCREENSHOT &&
        observedTick > 3600 &&
        observed.frame.player?.duck &&
        observed.frame.player.feet < 508000
      ) {
        await page.screenshot({ path: process.env.QA_PROGRESS_SCREENSHOT });
        progressCaptured = true;
        // Screenshot capture must not leave the dispatch clock stale.
        await observeClock();
      }
      const next = plan[planIndex];
      if (next && observedTick >= next.tick) {
        decisionTrace.push({
          plannedTick: next.tick,
          observedTick,
          action: next.action,
        });
        if (next.action === "JUMP") {
          if (held) {
            await up();
            held = false;
          }
          await down("Saltar");
          await up();
        } else if (next.action === "DUCK_DOWN" && !held) {
          await down("Mantener agachado");
          held = true;
        } else if (next.action === "DUCK_UP" && held) {
          await up();
          held = false;
        }
        planIndex++;
      }
      await page.waitForTimeout(4);
    }
    if (held) await up();
    const response = await verified,
      body = response.request().postDataJSON(),
      result = await response.json(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        target,
      );
    if (process.env.QA_RECORD_PATH)
      require("node:fs").writeFileSync(
        process.env.QA_RECORD_PATH,
        JSON.stringify(
          {
            manifest: issued.manifest,
            inputs: body.inputs,
            finalTick: body.final_tick,
            result,
            decisionTrace,
            nativeEvents: await page.evaluate(() => window.__alienEvents),
            plan: {
              inputs: plan,
              dispatched: planIndex,
              observedTick,
              finalTick: plannedState.tick,
              lives: plannedState.lives,
            },
          },
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
          unexpectedOutcome: result,
          failure: replay.failure,
          inputs: body.inputs,
          clockCorrections,
          plan: { dispatched: planIndex, observedTick },
        }),
      );
    assert.equal(result.won, !loss);
    assert.equal(submits, 1);
    assert.equal(
      body.inputs.filter((i) => i.action === "JUMP" && i.tick < 240).length,
      1,
      "Air double-tap does not add a second jump",
    );
    assert.ok(
      body.inputs.some((i) => i.action === "DUCK_DOWN" && i.tick < 240),
    );
    assert.ok(
      body.inputs.filter((i) => i.action === "DUCK_UP" && i.tick < 240)
        .length >= 2,
      "Cancel and DOM blur both release held crouch",
    );
    if (!loss) {
      assert.equal(body.final_tick, 14400);
      assert.ok(replay.state.actors.some((a) => a.fired));
      assert.ok(replay.state.collectibles.some((l) => l.collected));
      assert.ok(clockCorrections > 0);
    } else {
      assert.equal(replay.state.lives, 0);
      assert.ok(body.final_tick > 960);
    }
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      Number(
        await page
          .getByLabel("Avance del intento", { exact: true })
          .innerText(),
      ),
      replay.state.passed,
    );
    assert.equal(
      (await page.locator(".resultPanel").innerText()).includes("Puntos"),
      false,
    );
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    await page.setViewportSize(
      landscape ? { width: 320, height: 720 } : { width: 844, height: 390 },
    );
    await page.evaluate(() =>
      window.dispatchEvent(new Event("orientationchange")),
    );
    await page.locator("canvas.gameCanvas").waitFor({ state: "visible" });
    for (const name of ["Saltar", "Mantener agachado"]) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
    }
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: landscape ? "landscape" : "portrait",
        verified: true,
        won: result.won,
        score: result.score,
        reach: result.height,
        finalTick: body.final_tick,
        lives: replay.state.lives,
        inputs: body.inputs.length,
        clockCorrections,
        attackers: replay.state.actors.filter((a) => a.fired).length,
        pickups: replay.state.collectibles.filter((l) => l.collected).length,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
