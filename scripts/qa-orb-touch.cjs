// Full native-touch runs with issued scenarios and actual authoritative records.
// Observe forwarded drawing calls only; never change game state, clock or HTTP bodies.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");
const { writeFileSync } = require("node:fs");
const path = require("node:path");
const repo = process.env.QA_REPO_ROOT || path.resolve(__dirname, "..");
register(pathToFileURL(path.join(repo, "scripts/determinism-loader.mjs")));

(async () => {
  const load = (p) => import(pathToFileURL(path.join(repo, ".det-test", p)));
  const {
    ORB_BURST_CORE_V2: core,
    forecastOrbV2,
    orbCenterV2,
  } = await load("lib/verified/orbBurstCore.v2.js");
  const { orbDirection } = await load("lib/verified/orbBurstCore.v1.js");
  const { bestOrbAimV2, worstOrbAimV2 } = await load(
    "scripts/orb-v2-play-fixture.js",
  );
  const { replayCore } = await load("lib/verified/coreRuntime.v1.js");
  const loss = !!process.env.QA_LOSS,
    landscape = !!process.env.QA_LANDSCAPE;
  const viewport = landscape
    ? { width: 844, height: 390 }
    : { width: 390, height: 844 };
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const artifacts = { orientation: landscape ? "landscape" : "portrait", loss };
  try {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [],
      records = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/verify"))
        records.push(r.postDataJSON());
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "skill-arena-v12",
        JSON.stringify({
          onboarded: true,
          playerName: "QA_OrbV2",
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
      const palette = ["#66e9ff", "#ff8bbb", "#ffe082", "#a9f786", "#b9a0ff"];
      const gradients = new WeakMap(),
        p = CanvasRenderingContext2D.prototype;
      const clear = p.clearRect,
        gradient = p.createRadialGradient,
        fill = p.fill,
        stroke = p.stroke;
      const stop = CanvasGradient.prototype.addColorStop;
      const observing = (ctx) => ctx.canvas.classList.contains("gameCanvas");
      p.clearRect = function (...args) {
        if (observing(this)) window.__orbView = { spheres: [], ready: false };
        return clear.apply(this, args);
      };
      p.createRadialGradient = function (...args) {
        const g = gradient.apply(this, args);
        if (observing(this))
          gradients.set(g, { x: args[3], y: args[4], r: args[5], color: -1 });
        return g;
      };
      CanvasGradient.prototype.addColorStop = function (offset, color) {
        const m = gradients.get(this);
        if (m && offset === 0.28)
          m.color = palette.indexOf(String(color).toLowerCase());
        return stop.call(this, offset, color);
      };
      p.fill = function (...args) {
        const m = gradients.get(this.fillStyle);
        if (
          observing(this) &&
          window.__orbView &&
          m?.color >= 0 &&
          (m.r === 17 || m.r === 12)
        )
          window.__orbView.spheres.push({ ...m, origin: "shot" });
        return fill.apply(this, args);
      };
      p.stroke = function (...args) {
        if (observing(this) && window.__orbView) {
          const v = window.__orbView,
            s = String(this.strokeStyle).replace(/\s/g, ""),
            last = v.spheres.at(-1);
          if (s === "rgba(235,254,255,0.85)" && last) last.origin = "source";
          if (s === "rgba(16,29,44,0.45)" && last) last.origin = "pressure";
          if (s === "rgba(205,244,255,0.7)") {
            v.ready = true;
            const m = this.getTransform();
            v.matrix = { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
            v.pixelWidth = this.canvas.width;
            v.pixelHeight = this.canvas.height;
          }
        }
        return stroke.apply(this, args);
      };
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3084");
    await page
      .getByRole("button", { name: "Entrenamiento gratis", exact: true })
      .tap();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Orb Burst", exact: true })
      .tap();
    const issued = await (await start).json();
    assert.equal(issued.ok, true);
    assert.equal(issued.manifest.game_version, "2.0.0");
    artifacts.manifest = issued.manifest;
    const canvas = page.locator("canvas.gameCanvas"),
      cdp = await context.newCDPSession(page);
    const ready = () =>
      page.waitForFunction(
        () => window.__orbView?.ready,
        {},
        { timeout: 16000 },
      );
    const view = () => page.evaluate(() => window.__orbView);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await ready();
    let model = core.create(issued.manifest.seed),
      shots = 0,
      flights = 0,
      progressCaptured = false;
    let lastReadyMatrix = null,
      lastPixelWidth = 0,
      lastPixelHeight = 0;
    const cells = (state) =>
      state.bubbles
        .map((b) => {
          const q = orbCenterV2(state, b.row, b.col);
          return {
            x: q.xMilli / 1000,
            y: q.yMilli / 1000,
            color: b.color,
            origin: b.origin,
          };
        })
        .sort((a, b) => a.y - b.y || a.x - b.x);
    async function confirm(state) {
      await ready();
      const v = await view();
      const actual = v.spheres
        .filter((b) => b.r === 17 && b.y < 539)
        .map(({ x, y, color, origin }) => ({ x, y, color, origin }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      assert.deepEqual(
        actual,
        cells(state),
        "actual settled public field must equal the planning arena",
      );
      assert.equal(
        v.spheres.find((b) => b.r === 17 && b.x === 195 && b.y === 574)?.color,
        state.currentColor,
      );
      assert.equal(
        v.spheres.find((b) => b.r === 12 && b.x === 286)?.color,
        state.nextColor,
      );
      await page.waitForFunction(
        (h) =>
          document
            .querySelector(".orbVerified .coreHud")
            ?.textContent.includes(`AVANCE ${h}/108`),
        state.height,
      );
      assert.equal(
        await page.locator(".orbVerified .coreControls button").count(),
        0,
        "no separate launch button",
      );
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth),
        false,
      );
    }
    async function point(aim) {
      const v = await view(),
        rect = await canvas.boundingBox(),
        d = orbDirection(aim);
      lastReadyMatrix = v.matrix;
      lastPixelWidth = v.pixelWidth;
      lastPixelHeight = v.pixelHeight;
      const dy = Math.min(150, 185 * Math.abs(d.y / d.x || 1)),
        x = 195 - (d.x / d.y) * dy,
        y = 574 - dy,
        m = v.matrix;
      const p = {
        x: rect.x + ((m.a * x + m.c * y + m.e) * rect.width) / v.pixelWidth,
        y: rect.y + ((m.b * x + m.d * y + m.f) * rect.height) / v.pixelHeight,
      };
      assert.ok(
        p.x >= rect.x &&
          p.x <= rect.x + rect.width &&
          p.y >= rect.y &&
          p.y <= rect.y + rect.height,
        "native aim stays on the actual canvas",
      );
      return p;
    }
    const begin = (p) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [p],
      });
    const end = (cancel = false) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    async function gesture(aim) {
      await begin(await point(Math.max(0, Math.min(88, aim + 2))));
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [await point(aim)],
      });
      await page.waitForTimeout(25);
      await end();
    }
    await confirm(model);
    if (process.env.QA_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_SCREENSHOT });
    // Cancel and blur permit aim changes but never fire; exercise portrait/landscape/320px too.
    await begin(await point(44));
    await end(true);
    await page.waitForTimeout(50);
    await confirm(model);
    await begin(await point(30));
    await canvas.evaluate((c) => c.blur());
    await end();
    await page.waitForTimeout(50);
    await confirm(model);
    for (const size of [
      landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
      { width: 320, height: 740 },
      viewport,
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(120);
      await confirm(model);
    }
    const terminal = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 350000 },
    );
    terminal.catch(() => {});
    while (model.status === "running") {
      assert.ok(
        shots < 100,
        "complete finite course within the legitimate shot budget",
      );
      await confirm(model);
      const aim = loss ? worstOrbAimV2(model) : bestOrbAimV2(model),
        predicted = forecastOrbV2(model, aim).state;
      await gesture(aim);
      shots++;
      await page.waitForFunction(
        () =>
          window.__orbView &&
          !window.__orbView.ready &&
          window.__orbView.spheres.some(
            (b) => b.r === 17 && b.origin === "shot" && b.y > 539 && b.y < 570,
          ),
        {},
        { timeout: 1500 },
      );
      const first = await view();
      assert.equal(
        first.spheres.some((b) => b.r === 17 && b.x === 195 && b.y === 574),
        false,
        "launch must remove the orb from the launcher immediately",
      );
      const pose = (v) =>
        v.spheres.filter(
          (b) =>
            b.r === 17 &&
            b.origin === "shot" &&
            !cells(model).some((c) => c.x === b.x && c.y === b.y),
        );
      const before = pose(first);
      await page.waitForTimeout(35);
      const after = pose(await view());
      assert.ok(
        before.length && after.length,
        "actual projectile is visible in flight",
      );
      assert.notDeepEqual(
        before.map((b) => [b.x, b.y]),
        after.map((b) => [b.x, b.y]),
        "projectile visibly travels",
      );
      flights++;
      if (shots === 1) {
        // A second release during flight cannot add another shot.
        await begin(await pointFromFirst(first, 44));
        await end();
        await page.setViewportSize(
          landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
        );
        await page.waitForTimeout(100);
        await page.setViewportSize(viewport);
      }
      model = predicted;
      if (model.status !== "running") break;
      await confirm(model);
      if (
        process.env.QA_PROGRESS_SCREENSHOT &&
        !progressCaptured &&
        model.height >= 45
      ) {
        await page.screenshot({ path: process.env.QA_PROGRESS_SCREENSHOT });
        progressCaptured = true;
      }
      if (shots % 5 === 0)
        console.log(
          "progress",
          JSON.stringify({
            shots,
            height: model.height,
            pressure: model.pressureRows,
          }),
        );
    }
    // A captured pre-flight matrix remains a public drawing observation, not a private state read.
    async function pointFromFirst(v, aim) {
      const rect = await canvas.boundingBox(),
        d = orbDirection(aim),
        dy = 100,
        x = 195 - (d.x / d.y) * dy,
        y = 574 - dy,
        m = v.matrix;
      // The in-flight frame does not draw the ready guide; retain the last ready transform below.
      const matrix = m || lastReadyMatrix;
      return {
        x:
          rect.x +
          ((matrix.a * x + matrix.c * y + matrix.e) * rect.width) /
            lastPixelWidth,
        y:
          rect.y +
          ((matrix.b * x + matrix.d * y + matrix.f) * rect.height) /
            lastPixelHeight,
      };
    }
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
    artifacts.terminal = { payload, result };
    artifacts.reconstructed = {
      height: replay.height,
      score: replay.score,
      tick: replay.state.tick,
      timeMs: replay.timeMs,
      status: replay.state.status,
      failure: replay.failure,
    };
    assert.equal(response.status(), 200);
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.deepEqual(payload.manifest, issued.manifest);
    assert.equal(payload.ticket.attempt_id, issued.ticket.attempt_id);
    assert.equal(result.height, replay.height);
    assert.equal(result.score, replay.score);
    assert.equal(result.time_ms, replay.timeMs);
    assert.equal(result.won, !loss);
    assert.equal(replay.height, model.height);
    assert.equal(replay.score, replay.height);
    assert.equal(replay.state.shotOrdinal, shots);
    assert.deepEqual(cells(replay.state), cells(model));
    assert.equal(replay.state.pressureRows, model.pressureRows);
    assert.equal(
      payload.inputs.filter((i) => i.action === "SHOOT").length,
      shots,
      "cancel/blur/double taps never add shots",
    );
    assert.equal(records.length, 1, "one terminal record");
    assert.equal(flights, shots);
    assert.equal(replay.failure, loss ? "BOARD_OVERFLOW" : null);
    if (!loss) assert.equal(replay.height, 108);
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    if (process.env.QA_RESULT_SCREENSHOT)
      await page.screenshot({ path: process.env.QA_RESULT_SCREENSHOT });
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.seed, issued.manifest.seed);
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await ready();
    const fresh = core.create(again.manifest.seed);
    await confirm(fresh);
    assert.notDeepEqual(
      cells(fresh),
      cells(core.create(issued.manifest.seed)),
      "restart has a genuinely different visible arrangement",
    );
    await begin(await point(30));
    await end(true);
    await confirm(fresh);
    const abandoned = page.waitForResponse((r) =>
      r.url().includes("/verified-match/verify"),
    );
    await page.getByRole("button", { name: "Volver", exact: true }).tap();
    const receiptResponse = await abandoned,
      abandonedPayload = receiptResponse.request().postDataJSON(),
      receipt = await receiptResponse.json();
    artifacts.abandoned = { payload: abandonedPayload, receipt };
    assert.equal(abandonedPayload.record_kind, "abandoned");
    assert.ok(
      abandonedPayload.inputs.length > 0,
      "unfinished receipt includes a real touch input",
    );
    assert.equal(receipt.verified, false);
    assert.equal(receipt.received, true);
    assert.equal(receipt.final_tick, abandonedPayload.final_tick);
    assert.equal(receipt.attempt_id, again.ticket.attempt_id);
    assert.deepEqual(errors, []);
    assert.equal(records.length, 2);
    artifacts.ok = true;
    artifacts.summary = {
      orientation: artifacts.orientation,
      loss,
      shots,
      flights,
      height: replay.height,
      timeMs: replay.timeMs,
      pressure: replay.state.pressureRows,
      errors,
    };
    console.log(JSON.stringify(artifacts.summary));
  } finally {
    if (process.env.QA_REPLAY_PATH)
      writeFileSync(
        process.env.QA_REPLAY_PATH,
        JSON.stringify(artifacts, null, 2),
      );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
