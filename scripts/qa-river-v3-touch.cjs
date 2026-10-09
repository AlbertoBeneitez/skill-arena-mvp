// Native controls, issued seed and observable input timestamps. The steering
// mirror never changes the browser core, clock, target or server responses.
// Final truth comes from replaying the actual posted record, not the mirror.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
);
const assert = require("node:assert/strict"),
  { register } = require("node:module");
const { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href;
  const { RIVER_DASH_CORE_V3: core } = await import(
    base + "lib/verified/riverDashCore.v3.js"
  );
  const { planRiverV3NextSafe } = await import(
    base + "scripts/river-v3-play-fixture.js"
  );
  const { advanceCoreToTick, applyCoreInput, replayCore } = await import(
    base + "lib/verified/coreRuntime.v1.js"
  );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = !!process.env.QA_LANDSCAPE,
      loss = !!process.env.QA_LOSS;
    const context = await browser.newContext({
      viewport: landscape
        ? { width: 844, height: 390 }
        : { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
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
          playerName: "QA_River3",
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
      window.__riverEvents = [];
      const raf = requestAnimationFrame;
      window.requestAnimationFrame = (cb) => {
        if (window.__riverIssued && !window.__riverEpoch)
          window.__riverEpoch = performance.now();
        return raf(cb);
      };
      const originalFetch = window.fetch;
      window.fetch = (...args) =>
        originalFetch(...args).then((response) => {
          if (String(args[0]).includes("/verified-match/start"))
            window.__riverIssued = true;
          return response;
        });
      const actions = {
        Arriba: "UP",
        Abajo: "DOWN",
        Izquierda: "LEFT",
        Derecha: "RIGHT",
      };
      document.addEventListener(
        "pointerdown",
        (event) => {
          const button = event.target.closest?.(".coreControls button"),
            action = actions[button?.getAttribute("aria-label")];
          if (action)
            window.__riverEvents.push({ action, when: performance.now() });
        },
        true,
      );
      document.addEventListener("pointermove", event => {
        if (window.__qaRiverSwipe && event.target.matches?.("canvas.gameCanvas")) {
          window.__qaRiverSwipe = false;
          window.__riverEvents.push({ action: "UP", when: performance.now() });
        }
      }, true);
    });
    let starts = 0,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3073");
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a River Dash", exact: true })
      .tap();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "3.0.0");
    assert.equal(issued.manifest.input_protocol.version, 3);
    assert.equal(
      issued.manifest.competition.target_score,
      1e9,
      "natural complete field without rewriting the request",
    );
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(() => window.__riverEpoch > 0);
    assert.match(await page.locator(".coreHud").innerText(), /AVANCE 0\/64/);
    assert.equal(await page.locator(".coreHud strong, .coreHint").count(), 0);
    const cdp = await context.newCDPSession(page),
      points = {};
    const names = {
      UP: "Arriba",
      DOWN: "Abajo",
      LEFT: "Izquierda",
      RIGHT: "Derecha",
    };
    for (const [action, name] of Object.entries(names)) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44);
      points[action] = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    const canvas = await page.locator("canvas.gameCanvas").boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    assert.equal(starts, 1);
    async function tap(action) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [points[action]],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    const s = core.create(issued.manifest.seed),
      target = issued.manifest.competition.target_score;
    let eventIndex = 0,
      done = false,
      lastTap = -1000,
      screenshot = false,
      lastHeight = 0;
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 180000 },
    );
    verified
      .then(() => {
        done = true;
      })
      .catch(() => {});
    if (!loss) {
      const scale = Math.min(canvas.width / 390, canvas.height / 620);
      const point = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 + 30 * scale };
      await page.evaluate(() => { window.__qaRiverSwipe = true; });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x, y: point.y - 60 * scale }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      lastTap = await page.evaluate(() => performance.now());
    }
    async function sync() {
      const clock = await page.evaluate(() => ({
        epoch: window.__riverEpoch,
        now: performance.now(),
        events: window.__riverEvents,
      }));
      for (; eventIndex < clock.events.length; eventIndex++) {
        const event = clock.events[eventIndex];
        const tick = Math.max(
          0,
          Math.floor(((event.when - clock.epoch) * 120) / 1000),
        );
        advanceCoreToTick(core, s, tick, target);
        applyCoreInput(core, s, event.action, target);
      }
      advanceCoreToTick(
        core,
        s,
        Math.floor(((clock.now - clock.epoch) * 120) / 1000),
        target,
      );
      return clock;
    }
    for (let turn = 0; !done && turn < 8000; turn++) {
      const clock = await sync();
      if (s.status !== "running") break;
      if (clock.now - lastTap >= 280) {
        if (loss) {
          // Deliberately enter the visible opening traffic from its spawn edge.
          const left = s.lanes[63].direction === 1;
          const atEdge = left ? s.xMilli <= 20000 : s.xMilli >= 340000;
          await tap(atEdge ? "UP" : left ? "LEFT" : "RIGHT");
          lastTap = clock.now;
        } else {
          const leg = planRiverV3NextSafe(s, 12000),
            next = leg.inputs[0];
          if (next && next.tick <= s.tick + 2) {
            await tap(next.action);
            lastTap = clock.now;
          }
        }
      }
      assert.ok(
        s.height >= lastHeight && s.crossings === 0,
        "one field and monotone reach",
      );
      lastHeight = s.height;
      if (!screenshot && s.height >= 20 && process.env.QA_SCREENSHOT) {
        await page.screenshot({ path: process.env.QA_SCREENSHOT });
        screenshot = true;
      }
      if (turn % 200 === 0)
        console.log(
          "progress",
          JSON.stringify({ tick: s.tick, row: s.row, reach: s.height }),
        );
      await page.waitForTimeout(20);
    }
    const response = await verified,
      body = response.request().postDataJSON(),
      result = await response.json();
    const replay = replayCore(
      core,
      body.inputs,
      body.final_tick,
      issued.manifest.seed,
      target,
    );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.height);
    assert.equal(result.time_ms, replay.timeMs);
    assert.equal(result.won, !loss);
    if (!loss) assert.equal(body.inputs[0].action, "UP", "native upward swipe enters the first row once");
    assert.equal(replay.state.crossings, 0);
    if (!loss) {
      assert.equal(replay.height, 64);
      assert.equal(replay.score, 7600);
      assert.equal(replay.state.row, 0);
    } else
      assert.ok(
        ["RIVER_GAP", "TRAFFIC_COLLISION", "SWEPT_AWAY"].includes(
          replay.failure,
        ),
      );
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      Number(
        (
          await page
            .getByLabel("Avance del intento", { exact: true })
            .innerText()
        ).replace(/\./g, ""),
      ),
      result.height,
    );
    assert.equal(
      await page.getByLabel("Puntuación del intento", { exact: true }).count(),
      0,
    );
    assert.equal(submits, 1);
    const again = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const next = await (await again).json();
    assert.notEqual(next.manifest.match_id, issued.manifest.match_id);
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    assert.match(await page.locator(".coreHud").innerText(), /AVANCE 0\/64/);
    await page.setViewportSize(
      landscape ? { width: 320, height: 740 } : { width: 844, height: 390 },
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(starts, 2);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        landscape,
        won: result.won,
        height: result.height,
        score: result.score,
        finalTick: body.final_tick,
        inputs: body.inputs.length,
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
