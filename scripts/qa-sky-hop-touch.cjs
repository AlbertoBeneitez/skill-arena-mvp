// Real native-touch QA of the issued Sky Hop V3 run. Canvas calls are forwarded.
// Public scenario geometry may guide the actor; no React state, clock, HTTP body,
// manifest, target, seed or competitive state is changed or intercepted.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const { writeFileSync } = require("node:fs");
const repo = process.env.QA_REPO_ROOT || path.resolve(__dirname, "..");
register(pathToFileURL(path.join(repo, "scripts/determinism-loader.mjs")));

(async () => {
  const { SKY_HOP_CORE_V3: core } = await import(
    pathToFileURL(path.join(repo, ".det-test/lib/verified/skyHopCore.v3.js"))
  );
  const { replayCore, applyCoreInput, stepCore } = await import(
    pathToFileURL(path.join(repo, ".det-test/lib/verified/coreRuntime.v1.js"))
  );
  const landscape = !!process.env.QA_LANDSCAPE,
    loss = !!process.env.QA_LOSS;
  const lossKind = process.env.QA_LOSS_KIND || (landscape ? "fall" : "enemy");
  const requireRecovery =
    !loss &&
    (process.env.QA_RECOVERY === "1" ||
      (!landscape && process.env.QA_RECOVERY !== "0"));
  const requireStomp =
    !loss &&
    (process.env.QA_STOMP === "1" ||
      (landscape && process.env.QA_STOMP !== "0"));
  const originalViewport = landscape
    ? { width: 844, height: 390 }
    : { width: 390, height: 844 };
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: originalViewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [],
      records = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (request.url().includes("/verified-match/verify"))
        records.push(structuredClone(request.postDataJSON()));
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_SkyHopV3",
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
      window.__skyLandingEvents = [];
      const prototype = CanvasRenderingContext2D.prototype,
        state = new WeakMap();
      const observes = (ctx) => ctx.canvas.classList.contains("gameCanvas");
      const tracked = (ctx) => {
        let item = state.get(ctx);
        if (!item) {
          item = { origin: null, angle: 0, stack: [], path: [] };
          state.set(ctx, item);
        }
        return item;
      };
      const clear = prototype.clearRect,
        save = prototype.save,
        restore = prototype.restore,
        translate = prototype.translate,
        rotate = prototype.rotate,
        begin = prototype.beginPath,
        move = prototype.moveTo,
        line = prototype.lineTo,
        rect = prototype.fillRect,
        roundRect = prototype.roundRect,
        strokeRect = prototype.strokeRect,
        fill = prototype.fill;
      prototype.clearRect = function (...args) {
        if (observes(this)) {
          window.__skyView = {
            t: performance.now(),
            platforms: [],
            landings: [],
            enemies: [],
            ship: null,
            rising: false,
          };
          state.set(this, { origin: null, angle: 0, stack: [], path: [] });
        }
        return clear.apply(this, args);
      };
      prototype.save = function (...args) {
        if (observes(this)) {
          const s = tracked(this);
          s.stack.push({ origin: s.origin, angle: s.angle });
        }
        return save.apply(this, args);
      };
      prototype.restore = function (...args) {
        if (observes(this)) {
          const s = tracked(this),
            prev = s.stack.pop();
          if (prev) {
            s.origin = prev.origin;
            s.angle = prev.angle;
          }
        }
        return restore.apply(this, args);
      };
      prototype.translate = function (x, y, ...args) {
        if (observes(this)) tracked(this).origin = { x, y };
        return translate.call(this, x, y, ...args);
      };
      prototype.rotate = function (angle, ...args) {
        if (observes(this)) tracked(this).angle = angle;
        return rotate.call(this, angle, ...args);
      };
      prototype.beginPath = function (...args) {
        if (observes(this)) tracked(this).path = [];
        return begin.apply(this, args);
      };
      prototype.moveTo = function (x, y, ...args) {
        if (observes(this)) tracked(this).path.push(["M", x, y]);
        return move.call(this, x, y, ...args);
      };
      prototype.lineTo = function (x, y, ...args) {
        if (observes(this)) tracked(this).path.push(["L", x, y]);
        return line.call(this, x, y, ...args);
      };
      prototype.fillRect = function (x, y, w, h, ...args) {
        if (
          observes(this) &&
          window.__skyView &&
          h === 4 &&
          w > 60 &&
          [
            "#7fcde5",
            "#a999fa",
            "#f4c272",
            "#ef94aa",
            "#87e8c4",
            "#a8f0d6",
          ].includes(this.fillStyle)
        )
          window.__skyView.platforms.push({ x, y, w, color: this.fillStyle });
        return rect.call(this, x, y, w, h, ...args);
      };
      prototype.roundRect = function (x, y, w, h, ...args) {
        if (
          observes(this) &&
          window.__skyView &&
          this.fillStyle === "#f3b5c5" &&
          x === -11 &&
          y === -13 &&
          w === 22 &&
          h === 26
        ) {
          const s = tracked(this);
          if (s.origin)
            window.__skyView.enemies.push({ ...s.origin, armed: false });
        }
        return roundRect.call(this, x, y, w, h, ...args);
      };
      prototype.strokeRect = function (x, y, w, h, ...args) {
        const stroke = String(this.strokeStyle).replace(/\s/g, "");
        if (
          observes(this) &&
          window.__skyView &&
          (stroke.startsWith("rgba(221,249,255,") || stroke === "#ddf9ff") &&
          this.lineWidth === 2 &&
          h >= 14 &&
          h < 14 + 24 * 0.24 &&
          w > 60
        ) {
          const age = (h - 14) / 0.24;
          window.__skyView.landings.push({
            x: x + age * 0.35,
            y: y + age * 0.12,
            w: w - age * 0.7,
            age,
          });
        }
        if (
          observes(this) &&
          window.__skyView &&
          x === -11 &&
          y === -13 &&
          w === 22 &&
          h === 26
        ) {
          const enemy = window.__skyView.enemies.at(-1);
          if (enemy) enemy.armed = this.strokeStyle === "#ff719b";
        }
        return strokeRect.call(this, x, y, w, h, ...args);
      };
      prototype.fill = function (...args) {
        if (observes(this) && window.__skyView) {
          const s = tracked(this),
            p = s.path,
            color = String(this.fillStyle).replace(/\s/g, "");
          if (
            color === "#edf4fd" &&
            p[0]?.[0] === "M" &&
            p[0][1] === 0 &&
            p[0][2] === -19 &&
            p[1]?.[1] === 16 &&
            p[1][2] === 12 &&
            s.origin
          ) {
            window.__skyView.ship = { ...s.origin, vx: s.angle * 10000 };
            // Snapshot only forwarded public drawing calls. This keeps the
            // actual 24-tick landing pulse visible to a slower touch actor.
            if (window.__skyView.landings.length)
              window.__skyLandingEvents.push(structuredClone(window.__skyView));
          }
          if (
            color === "rgba(115,201,248,0.3)" &&
            p[0]?.[1] === -7 &&
            p[0][2] === 13
          )
            window.__skyView.rising = true;
        }
        return fill.apply(this, args);
      };
    });

    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3000");
    await page
      .getByRole("button", { name: "Entrenamiento gratis", exact: true })
      .tap();
    const starting = page.waitForResponse((response) =>
      response.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: /^(Jugar a )?Sky Hop$/ }).tap();
    const issued = await (await starting).json();
    assert.equal(issued.ok, true);
    assert.equal(issued.manifest.game_id, "sky-hop");
    assert.equal(issued.manifest.game_version, "3.0.0");
    assert.equal(issued.manifest.competition.target_score, 1000000000);
    const publicCourse = core.create(issued.manifest.seed),
      palette = {
        normal: "#7fcde5",
        boost: "#a999fa",
        moving: "#f4c272",
        crumble: "#ef94aa",
        checkpoint: "#87e8c4",
        goal: "#a8f0d6",
      };
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(() => !!window.__skyView?.ship);
    const cdp = await context.newCDPSession(page),
      controls = {
        LEFT_DOWN: "Dirigir izquierda",
        RIGHT_DOWN: "Dirigir derecha",
      };
    let held = null,
      heldPointer = null;
    async function controlPoint(action) {
      const box = await page
        .getByRole("button", { name: controls[action], exact: true })
        .boundingBox();
      assert.ok(
        box && box.width >= 44 && box.height >= 44,
        "touch target ≥44px",
      );
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
    }
    async function release(cancel = false) {
      if (!held) return;
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
      held = null;
      heldPointer = null;
    }
    async function press(action) {
      if (held === action) return;
      await release();
      heldPointer = await controlPoint(action);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [heldPointer],
      });
      held = action;
    }
    async function steer(action) {
      if (held !== action) await release();
      if (action && held !== action) await press(action);
    }
    async function layout() {
      await page.waitForFunction(
        () => !!window.__skyView?.ship && window.__skyView.platforms.length > 0,
      );
      await controlPoint("LEFT_DOWN");
      await controlPoint("RIGHT_DOWN");
      const canvas = await page.locator("canvas.gameCanvas").boundingBox(),
        buttons = await page.locator(".coreControls").boundingBox();
      assert.ok(canvas && buttons, "game and controls visible");
      assert.ok(
        buttons.x >= canvas.x + canvas.width - 1 ||
          buttons.y >= canvas.y + canvas.height - 1,
        "controls do not cover the course",
      );
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth),
        false,
        "no horizontal overflow",
      );
    }
    async function hud() {
      const text = await page.locator(".skyHopVerified .coreHud").innerText();
      const height = text.match(/ALTURA\s+(\d+)\s*\/\s*(\d+)/),
        lives = text.match(/VIDAS\s+(\d+)/);
      assert.ok(height && lives, `observable physical HUD: ${text}`);
      return {
        height: Number(height[1]),
        goal: Number(height[2]),
        lives: Number(lives[1]),
      };
    }
    await layout();
    assert.equal(await page.locator(".coreHint,.tutorialOverlay").count(), 0);
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    const terminal = page.waitForResponse(
      (response) => response.url().includes("/verified-match/verify"),
      { timeout: 240000 },
    );
    let done = false;
    terminal
      .then(() => {
        done = true;
      })
      .catch(() => {});
    await press("LEFT_DOWN");
    await release(true);
    await page
      .getByRole("button", { name: controls.RIGHT_DOWN, exact: true })
      .focus();
    await press("RIGHT_DOWN");
    await page.locator("canvas.gameCanvas").focus(); // Real DOM focus loss invokes onBlur.
    await release();
    // Orientation while held must not duplicate input; a native cancel releases it.
    await press("LEFT_DOWN");
    await page.setViewportSize(
      landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
    );
    await release(true);
    await layout();
    await page.setViewportSize({ width: 320, height: 740 });
    await layout();
    await page.setViewportSize(originalViewport);
    await layout();
    // Rapid same-control taps must remain a valid DOWN/UP sequence in the record.
    await press("RIGHT_DOWN");
    await release();
    await press("RIGHT_DOWN");
    await release();

    const actor = { runObservedCourse, assertReplayEvidence };
    const evidence = await actor.runObservedCourse({
      page,
      core,
      publicCourse,
      palette,
      loss,
      lossKind,
      requireRecovery,
      requireStomp,
      hud,
      steer,
      release,
      layout,
      originalViewport,
      isDone: () => done,
    });
    await release();
    const response = await terminal,
      payload = response.request().postDataJSON(),
      result = await response.json();
    const replay = replayCore(
      core,
      payload.inputs,
      payload.final_tick,
      issued.manifest.seed,
      issued.manifest.competition.target_score,
    );
    const replayPath =
      process.env.QA_REPLAY_PATH ||
      process.env.QA_SCREENSHOT?.replace(/\.[^.]+$/, "-records.json");
    const terminalArtifact = {
      manifest: issued.manifest,
      terminal: { payload, result },
      reconstructed: {
        height: replay.height,
        score: replay.score,
        finalTick: replay.state.tick,
        timeMs: replay.timeMs,
        status: replay.state.status,
        failure: replay.failure,
      },
      observedEvidence: evidence,
    };
    if (replayPath)
      writeFileSync(replayPath, JSON.stringify(terminalArtifact, null, 2), {
        mode: 0o600,
      });
    assert.equal(response.status(), 200);
    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.equal(payload.record_kind ?? "terminal", "terminal");
    assert.deepEqual(payload.manifest, issued.manifest);
    assert.equal(payload.ticket.attempt_id, issued.ticket.attempt_id);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(replay.state.tick, payload.final_tick);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.height);
    assert.equal(result.time_ms, replay.timeMs);
    assert.equal(result.won, !loss);
    assert.equal(replay.won, !loss);
    assert.equal(result.failure ?? null, replay.failure ?? null);
    assert.equal(records.length, 1, "one immutable terminal submission");
    assert.deepEqual(records[0], payload, "request snapshot remains unchanged");
    assert.ok(
      payload.inputs.some((input) => input.action === "LEFT_UP"),
      "cancel releases left",
    );
    assert.ok(
      payload.inputs.some((input) => input.action === "RIGHT_UP"),
      "blur releases right",
    );
    assert.ok(
      payload.inputs.every(
        (input, index) => !index || input.tick > payload.inputs[index - 1].tick,
      ),
      "strict ordered unique ticks",
    );
    await actor.assertReplayEvidence({
      core,
      replay,
      payload,
      issued,
      evidence,
      loss,
      lossKind,
      requireRecovery,
      requireStomp,
      applyCoreInput,
      stepCore,
    });
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.doesNotMatch(
      await page.locator(".resultPanel").innerText(),
      /Puntos|Nivel/i,
    );
    if (process.env.QA_RESULT_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_RESULT_SCREENSHOT });
    await layoutResult();
    const restarting = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const again = await (await restarting).json();
    assert.equal(again.ok, true);
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    assert.notEqual(again.manifest.seed, issued.manifest.seed);
    const restartCourse = core.create(again.manifest.seed);
    assert.notDeepEqual(
      restartCourse.platforms,
      publicCourse.platforms,
      "independently issued restart has a different course",
    );
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(() => !!window.__skyView?.ship);
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    await layout();
    await press("LEFT_DOWN");
    await release(true);
    await page
      .getByRole("button", { name: controls.RIGHT_DOWN, exact: true })
      .focus();
    await press("RIGHT_DOWN");
    await page.locator("canvas.gameCanvas").focus();
    await release();
    const abandoning = page.waitForResponse((r) =>
      r.url().includes("/verified-match/verify"),
    );
    await page.getByRole("button", { name: "Volver", exact: true }).tap();
    const abandonedResponse = await abandoning,
      abandonedPayload = abandonedResponse.request().postDataJSON(),
      receipt = await abandonedResponse.json();
    const prefix = replayCore(
      core,
      abandonedPayload.inputs,
      abandonedPayload.final_tick,
      again.manifest.seed,
      again.manifest.competition.target_score,
    );
    assert.equal(abandonedResponse.status(), 200);
    assert.equal(abandonedPayload.record_kind, "abandoned");
    assert.deepEqual(abandonedPayload.manifest, again.manifest);
    assert.equal(abandonedPayload.ticket.attempt_id, again.ticket.attempt_id);
    assert.ok(
      abandonedPayload.inputs.length >= 4,
      "abandonment includes actual touch prefix",
    );
    assert.equal(prefix.error, "CLIENT_ENDED_BEFORE_RESOLUTION");
    assert.equal(prefix.state.tick, abandonedPayload.final_tick);
    assert.equal(prefix.state.status, "running");
    assert.equal(receipt.received, true);
    assert.equal(receipt.verified, false);
    assert.equal(receipt.final_tick, abandonedPayload.final_tick);
    assert.equal(records.length, 2);
    assert.deepEqual(records[1], abandonedPayload);
    for (const forbidden of [
      "score",
      "height",
      "won",
      "time_ms",
      "verification_id",
    ])
      assert.equal(forbidden in receipt, false, "receipt never adjudicates");
    await page.getByRole("region", { name: "Catálogo de juegos" }).waitFor();
    assert.deepEqual(errors, []);
    const output = {
      ok: true,
      orientation: landscape ? "landscape" : "portrait",
      loss,
      lossKind: loss ? lossKind : null,
      verified: true,
      won: result.won,
      height: replay.height,
      score: replay.score,
      finalTick: replay.state.tick,
      timeMs: replay.timeMs,
      failure: replay.failure,
      lives: replay.state.lives,
      inputs: payload.inputs.length,
      evidence,
      restart: true,
      abandonedReceipt: true,
      errors,
    };
    if (replayPath)
      writeFileSync(
        replayPath,
        JSON.stringify(
          {
            ...terminalArtifact,
            summary: output,
            abandoned: { payload: abandonedPayload, receipt },
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
    console.log(JSON.stringify(output));
    async function layoutResult() {
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth),
        false,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function skyPlatformColor(platform, course, palette) {
  return platform === course.platforms.at(-1)
    ? palette.goal
    : palette[platform.kind];
}

function readScene(raw, course, palette, previousCamera) {
  if (!raw?.ship) return null;
  let best = null;
  for (const v of raw.platforms)
    for (const p of course.platforms) {
      if (
        p.drift ||
        Math.abs(p.x / 1000 - v.x) > 0.01 ||
        p.width / 1000 !== v.w ||
        skyPlatformColor(p, course, palette) !== v.color
      )
        continue;
      const camera = p.y - v.y * 1000;
      let matches = 0;
      for (const q of raw.platforms)
        if (
          course.platforms.some(
            (p) =>
              Math.abs((p.y - camera) / 1000 - q.y) < 0.01 &&
              p.width / 1000 === q.w &&
              skyPlatformColor(p, course, palette) === q.color,
          )
        )
          matches++;
      if (
        !best ||
        matches > best.matches ||
        (matches === best.matches &&
          Math.abs(camera - previousCamera) <
            Math.abs(best.camera - previousCamera))
      )
        best = { camera, matches };
    }
  if (!best) return null;
  const platforms = raw.platforms.map((v) => ({
    ...v,
    index: course.platforms.findIndex(
      (p) =>
        Math.abs(p.y - v.y * 1000 - best.camera) < 1 &&
        p.width / 1000 === v.w &&
        skyPlatformColor(p, course, palette) === v.color,
    ),
  }));
  const enemies = raw.enemies.map((e) => ({
    ...e,
    index: course.enemies.findIndex(
      (q) => Math.abs(q.y - e.y * 1000 - best.camera) < 1,
    ),
  }));
  return {
    ...raw,
    platforms,
    enemies,
    camera: best.camera,
    x: raw.ship.x * 1000,
    y: raw.ship.y * 1000 + best.camera,
    vx: raw.ship.vx,
  };
}

async function runObservedCourse(options) {
  const {
    page,
    publicCourse,
    palette,
    loss,
    lossKind,
    requireRecovery,
    requireStomp,
    hud,
    steer,
    isDone,
  } = options;
  const evidence = {
    recoveryRequested: requireRecovery,
    stompRequested: requireStomp,
    observedLandings: [],
    observedDamage: [],
    stompAttempted: false,
  };
  let camera = 0,
    lastLanded = 0,
    landingCursor = 0,
    landingCamera = 0,
    lastLives = (await hud()).lives;
  let forcingFall = false,
    recoveryStarted = false,
    recovered = false,
    stompIndex = null,
    stompCommitted = false,
    stompObserved = false,
    enemyDamageObserved = false,
    gapTarget = null,
    progressCapturePromise = null,
    progressCaptured = false;
  const attemptedStomps = new Set();
  let stompStartedAt = null;
  const deadline = Date.now() + 230000;
  for (let turn = 0; !isDone() && Date.now() < deadline; turn++) {
    const sample = await page.evaluate(
        (cursor) => ({
          view: window.__skyView,
          events: window.__skyLandingEvents.slice(cursor),
          cursor: window.__skyLandingEvents.length,
        }),
        landingCursor,
      ),
      view = readScene(sample.view, publicCourse, palette, camera);
    landingCursor = sample.cursor;
    for (const event of sample.events) {
      const landingView = readScene(
        event,
        publicCourse,
        palette,
        landingCamera,
      );
      if (!landingView) continue;
      landingCamera = landingView.camera;
      for (const pulse of event.landings) {
        const index = publicCourse.platforms.findIndex(
          (platform) =>
            Math.abs(platform.y - pulse.y * 1000 - landingCamera) < 1 &&
            Math.abs(platform.width - pulse.w * 1000) < 1,
        );
        assert.ok(
          index >= 0,
          "actual landing pulse binds to public support geometry",
        );
        lastLanded = index;
        if (evidence.observedLandings.at(-1) !== index)
          evidence.observedLandings.push(index);
      }
    }
    if (!view) {
      await page.waitForTimeout(20);
      continue;
    }
    const respawnObserved = view.camera > camera + 1000;
    camera = view.camera;
    if (respawnObserved) {
      if (forcingFall) {
        forcingFall = false;
        recovered = true;
      }
      stompIndex = null;
      stompCommitted = false;
      stompStartedAt = null;
    }
    if (isDone()) break;
    const stats = await hud();
    if (stats.lives < lastLives) {
      if (loss && lossKind === "enemy" && evidence.enemyTargeted)
        enemyDamageObserved = true;
      evidence.observedDamage.push({
        height: stats.height,
        lives: stats.lives,
        lastLanded,
        forcingFall,
      });
      if (forcingFall) {
        forcingFall = false;
        recovered = true;
      }
      stompIndex = null;
      stompCommitted = false;
      stompStartedAt = null;
    }
    lastLives = stats.lives;
    const nextIndex = Math.min(75, lastLanded + 1),
      next = publicCourse.platforms[nextIndex];
    const nextVisible = view.platforms.find((v) => v.index === nextIndex);
    let target = nextVisible
      ? nextVisible.x * 1000 + next.width / 2
      : next.x + next.width / 2;
    if (
      requireRecovery &&
      !recoveryStarted &&
      lastLanded > 0 &&
      publicCourse.platforms[lastLanded]?.kind === "crumble" &&
      lastLanded >= 10
    ) {
      forcingFall = true;
      recoveryStarted = true;
      evidence.crumbleIndex = lastLanded;
      evidence.recoveryHighest = stats.height;
    }
    if (
      forcingFall ||
      (loss && lossKind === "fall" && stats.height >= 12) ||
      (loss && lossKind === "enemy" && enemyDamageObserved)
    ) {
      // A visible side gap remains a deliberate decision; screen wrap alone
      // cannot manufacture a terminal. The actual submitted replay decides it.
      gapTarget ??= view.x < 195000 ? 5000 : 385000;
      target = gapTarget;
    } else if (
      loss &&
      (lossKind === "enemy" || lossKind === "enemy-terminal")
    ) {
      const enemy = view.enemies
        .filter(
          (e) =>
            e.index >= 0 &&
            e.armed &&
            publicCourse.enemies[e.index].platform >= lastLanded &&
            publicCourse.enemies[e.index].platform <= nextIndex,
        )
        .sort(
          (a, b) =>
            publicCourse.enemies[a.index].platform -
            publicCourse.enemies[b.index].platform,
        )[0];
      if (enemy) {
        target = enemy.x * 1000;
        evidence.enemyTargeted = true;
      }
    } else if (requireStomp && !stompObserved) {
      if (
        stompStartedAt !== null &&
        view.t - stompStartedAt > (800 * 1000) / 120
      ) {
        stompIndex = null;
        stompCommitted = false;
        stompStartedAt = null;
      }
      if (stompIndex === null && stats.lives >= 2) {
        const candidate = view.enemies.find(
          (e) =>
            e.index >= 0 &&
            publicCourse.enemies[e.index].platform === lastLanded &&
            !attemptedStomps.has(e.index),
        );
        if (candidate) {
          stompIndex = candidate.index;
          attemptedStomps.add(candidate.index);
          stompStartedAt = view.t;
          evidence.stompAttempted = true;
        }
      }
      if (stompIndex !== null) {
        const meta = publicCourse.enemies[stompIndex],
          enemy = view.enemies.find((e) => e.index === stompIndex),
          support = publicCourse.platforms[meta.platform],
          supportView = view.platforms.find((v) => v.index === meta.platform);
        if (
          !enemy &&
          view.rising &&
          Math.abs(view.y - (meta.y - 32000)) < 32000
        ) {
          stompObserved = true;
          evidence.stompDisappearedIndex = stompIndex;
          stompIndex = null;
        } else {
          const safeCenter = supportView
            ? supportView.x * 1000 + support.width / 2
            : support.x + support.width / 2;
          // The final V3 sentry patrols outside and below its support. Leaving
          // that support while it is visibly armed creates a legal rescue stomp.
          if (enemy?.armed && view.y + 19000 <= meta.y - 13000 - 5000)
            stompCommitted = true;
          target = stompCommitted && enemy ? enemy.x * 1000 : safeCenter;
        }
      }
    }
    const error = target - (view.x + view.vx * 7),
      tolerance =
        forcingFall ||
        (loss && lossKind === "fall" && stats.height >= 12) ||
        (loss && lossKind === "enemy" && enemyDamageObserved)
          ? 3000
          : view.enemies.some(
                (e) => e.armed && Math.abs(e.y - view.ship.y) < 160,
              )
            ? stompCommitted || (loss && lossKind.startsWith("enemy"))
              ? 4000
              : 5000
            : 14000,
      action =
        error > tolerance
          ? "RIGHT_DOWN"
          : error < -tolerance
            ? "LEFT_DOWN"
            : null;
    await steer(action);
    if (
      process.env.QA_PROGRESS_SCREENSHOT &&
      !progressCaptured &&
      stats.height >= 20
    ) {
      // Diagnostic capture must not suspend touch steering while a direction
      // remains held. Await its completion only after the actual terminal.
      progressCapturePromise = page.screenshot({
        path: process.env.QA_PROGRESS_SCREENSHOT,
      });
      progressCapturePromise.catch(() => {});
      progressCaptured = true;
    }
    if (turn % 300 === 0)
      console.log(
        "visible",
        JSON.stringify({
          landed: lastLanded,
          height: stats.height,
          lives: stats.lives,
          enemies: view.enemies.length,
          forcingFall,
          stompIndex,
          stompObserved,
        }),
      );
    await page.waitForTimeout(20);
  }
  assert.equal(isDone(), true, "actual run must resolve before QA deadline");
  await progressCapturePromise;
  evidence.recoveryObserved = recovered;
  evidence.stompDisappeared = stompObserved;
  return evidence;
}

async function assertReplayEvidence({
  core,
  replay,
  payload,
  issued,
  evidence,
  loss,
  lossKind,
  requireRecovery,
  requireStomp,
  applyCoreInput,
  stepCore,
}) {
  const state = core.create(issued.manifest.seed),
    trace = [],
    stomps = [];
  let inputIndex = 0;
  for (let tick = 0; tick <= payload.final_tick; tick++) {
    if (
      inputIndex < payload.inputs.length &&
      payload.inputs[inputIndex].tick === state.tick
    ) {
      const action = payload.inputs[inputIndex++].action;
      assert.equal(
        applyCoreInput(
          core,
          state,
          action,
          issued.manifest.competition.target_score,
        ),
        true,
      );
    }
    if (state.tick >= payload.final_tick) break;
    const before = {
      lives: state.lives,
      height: state.height,
      checkpoint: state.checkpoint,
      lastLandingIndex: state.lastLandingIndex,
      tick: state.tick,
      brokenAt: [...state.brokenAt],
      collected: [...state.collected],
      left: state.left,
      right: state.right,
      stomps: state.stomps,
    };
    stepCore(core, state, issued.manifest.competition.target_score);
    if (state.lives < before.lives) {
      const alien = state.lastEnemyHitTick === state.tick;
      trace.push({
        tick: state.tick,
        cause: alien ? "ALIEN_CONTACT" : "FALLEN",
        beforeHeight: before.height,
        height: state.height,
        checkpoint: state.checkpoint,
        lastLandingIndex: before.lastLandingIndex,
        lives: state.lives,
        pickupsPreserved: before.collected.every(
          (value, index) => value === state.collected[index],
        ),
        heldPreserved:
          state.left === before.left && state.right === before.right,
        recoveryGrace: state.respawnUntil - state.tick,
        livingRearmed: state.enemyArmedAt.every(
          (deadline, index) =>
            state.enemyDefeatedAt[index] >= 0 || deadline === -1,
        ),
        brokenRouteIndices: before.brokenAt.flatMap((deadline, index) =>
          index > before.checkpoint && deadline >= 0 && deadline <= before.tick
            ? [index]
            : [],
        ),
        crumbleWasBroken: before.brokenAt.some(
          (deadline, index) =>
            index > before.checkpoint &&
            deadline >= 0 &&
            deadline <= before.tick,
        ),
        restored:
          state.status === "running" &&
          state.brokenAt
            .slice(state.checkpoint + 1)
            .every((value) => value === -1),
      });
    }
    if (state.stomps > before.stomps)
      stomps.push({
        tick: state.tick,
        x: state.lastStompX,
        y: state.lastStompY,
        height: state.height,
      });
  }
  assert.equal(inputIndex, payload.inputs.length);
  assert.deepEqual(
    state,
    replay.state,
    "event trace reproduces actual terminal state",
  );
  evidence.actualDamage = trace;
  evidence.actualStomps = stomps;
  if (loss) {
    if (lossKind === "enemy" || lossKind === "enemy-terminal") {
      assert.ok(
        state.enemyContacts > 0,
        "actual posted inputs hit a warned alien",
      );
      const contactRecovery = trace.find(
        (event) => event.cause === "ALIEN_CONTACT" && event.lives > 0,
      );
      assert.ok(
        contactRecovery,
        "actual contact recovers before the deliberate fall",
      );
      assert.equal(contactRecovery.height, contactRecovery.beforeHeight);
      assert.equal(contactRecovery.pickupsPreserved, true);
      assert.equal(contactRecovery.heldPreserved, true);
      assert.equal(contactRecovery.recoveryGrace, 90);
      assert.equal(contactRecovery.livingRearmed, true);
      assert.equal(contactRecovery.restored, true);
      assert.equal(
        replay.failure,
        lossKind === "enemy-terminal" ? "ALIEN_CONTACT" : "FALLEN",
      );
      if (lossKind === "enemy")
        assert.ok(
          trace.some((event) => event.cause === "FALLEN"),
          "actual alien contact is followed by a real fall",
        );
    } else {
      assert.ok(trace.some((event) => event.cause === "FALLEN"));
      assert.equal(replay.failure, "FALLEN");
    }
    assert.equal(state.lives, 0);
  } else {
    assert.equal(replay.height, 75);
    assert.equal(state.highest, 75);
    assert.ok(state.collected.some(Boolean));
    if (requireRecovery) {
      const recovery = trace.find(
        (event) =>
          event.cause === "FALLEN" &&
          event.crumbleWasBroken &&
          event.restored &&
          event.checkpoint > 0 &&
          event.lives > 0,
      );
      assert.ok(
        recovery,
        "actual crumbly-support fall restores route from its checkpoint",
      );
      assert.equal(
        recovery.height,
        recovery.beforeHeight,
        "recovery preserves attained progress",
      );
      assert.ok(
        recovery.brokenRouteIndices.length > 0,
        "an expired crumble existed ahead of the checkpoint",
      );
      assert.equal(
        recovery.pickupsPreserved,
        true,
        "checkpoint recovery does not refill collected pickups",
      );
      assert.equal(recovery.heldPreserved, true);
      assert.equal(recovery.recoveryGrace, 90);
      assert.equal(recovery.livingRearmed, true);
      evidence.recoveryProof = recovery;
      assert.ok(
        state.highest > recovery.height,
        "recovered player continues to the original goal",
      );
    }
    if (requireStomp)
      assert.ok(
        stomps.length > 0,
        "actual descending contact defeats a living alien",
      );
  }
}
