// Native touch QA driven by forwarded public drawing calls, never React state.
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
  const { SERPENT_CORE_V2: core } = await import(
      base + "lib/verified/serpentCore.v2.js"
    ),
    { chooseSerpentTurn } = await import(
      base + "scripts/serpent-play-fixture.js"
    ),
    { replayCore } = await import(base + "lib/verified/coreRuntime.v1.js");
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
          playerName: "QA_Serpent",
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
      const p = CanvasRenderingContext2D.prototype,
        clear = p.clearRect,
        rect = p.strokeRect,
        round = p.roundRect,
        arc = p.arc,
        match = (c) => c.canvas.classList.contains("gameCanvas");
      p.clearRect = function (...a) {
        if (match(this))
          window.__serpentView = { board: null, snake: [], food: null };
        return clear.apply(this, a);
      };
      p.strokeRect = function (x, y, w, h, ...a) {
        if (match(this) && this.strokeStyle === "#4bb2bb")
          window.__serpentView.board = { x, y, w, h, cell: w / 18 };
        return rect.call(this, x, y, w, h, ...a);
      };
      p.roundRect = function (x, y, w, h, ...a) {
        const v = window.__serpentView;
        if (
          match(this) &&
          v?.board &&
          Math.abs(w - (v.board.cell - 2)) < 0.01 &&
          Math.abs(h - w) < 0.01
        )
          v.snake.push({
            x: Math.round((x - v.board.x - 1) / v.board.cell),
            y: Math.round((y - v.board.y - 1) / v.board.cell),
          });
        return round.call(this, x, y, w, h, ...a);
      };
      p.arc = function (x, y, r, ...a) {
        const v = window.__serpentView;
        if (match(this) && v?.board && this.fillStyle === "#ffe896")
          v.food = {
            x: Math.round((x - v.board.x) / v.board.cell - 0.5),
            y: Math.round((y - v.board.y) / v.board.cell - 0.5),
          };
        return arc.call(this, x, y, r, ...a);
      };
    });
    let starts = 0,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3089");
    if (!loss)
      await page
        .getByRole("button", {
          name: "Reto con 5 euros ficticios",
          exact: true,
        })
        .tap();
    const start = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Serpent", exact: true })
      .tap();
    const issued = await (await start).json();
    assert.equal(issued.manifest.game_version, "2.0.0");
    assert.equal(
      issued.manifest.competition.target_score,
      loss ? 1_000_000_000 : 7000,
    );
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        window.__serpentView?.snake.length >= 3 && window.__serpentView?.food,
    );
    const buttons = {
        UP: "Arriba",
        DOWN: "Abajo",
        LEFT: "Izquierda",
        RIGHT: "Derecha",
      },
      boxes = {};
    for (const [action, name] of Object.entries(buttons)) {
      const r = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(r.width >= 70 && r.height >= 60);
      boxes[action] = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    const cdp = await context.newCDPSession(page);
    async function turn(action) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [boxes[action]],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    let done = false;
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 180000 },
    );
    verified.then(() => (done = true)).catch(() => {});
    let previous = null,
      direction = "RIGHT",
      lastSent = null,
      screenshot = false;
    const clockwise = { UP: "RIGHT", RIGHT: "DOWN", DOWN: "LEFT", LEFT: "UP" };
    for (let i = 0; !done && i < 14000; i++) {
      const v = await page.evaluate(() => window.__serpentView);
      if (v?.snake.length && v.food) {
        const head = v.snake[0];
        if (!previous || head.x !== previous.x || head.y !== previous.y) {
          if (previous) {
            const dx = head.x - previous.x,
              dy = head.y - previous.y;
            direction =
              dx === 1 || dx === -17
                ? "RIGHT"
                : dx === -1 || dx === 17
                  ? "LEFT"
                  : dy === 1 || dy === -27
                    ? "DOWN"
                    : "UP";
          }
          const foods = v.snake.length - 3;
          const action =
            loss && foods >= 3
              ? clockwise[direction]
              : chooseSerpentTurn({ snake: v.snake, food: v.food, direction });
          if (action !== direction && action !== lastSent) {
            await turn(action);
            lastSent = action;
          } else if (action === direction) lastSent = null;
          previous = head;
          if (!screenshot && foods >= 2 && process.env.QA_SCREENSHOT) {
            await page.screenshot({ path: process.env.QA_SCREENSHOT });
            screenshot = true;
          }
        }
      }
      await page.waitForTimeout(10);
    }
    const response = await verified,
      result = await response.json(),
      body = response.request().postDataJSON();
    const replay = replayCore(
      core,
      body.inputs,
      body.final_tick,
      issued.manifest.seed,
      issued.manifest.competition.target_score,
    );
    assert.equal(result.verified, true);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.state.foods);
    assert.equal(result.time_ms, replay.timeMs);
    assert.equal(result.won, !loss);
    assert.equal(submits, 1);
    assert.equal(starts, 1);
    if (loss) assert.equal(replay.failure, "SELF_COLLISION");
    else assert.equal(replay.state.foods, 7);
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      Number(
        await page
          .getByLabel("Avance del intento", { exact: true })
          .innerText(),
      ),
      replay.state.foods,
    );
    const nextStart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const next = await (await nextStart).json();
    assert.notEqual(next.manifest.seed, issued.manifest.seed);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.setViewportSize(
      landscape ? { width: 320, height: 720 } : { width: 844, height: 390 },
    );
    for (const name of Object.values(buttons)) {
      const r = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(r.width >= 70 && r.height >= 60);
    }
    assert.equal(starts, 2);
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
        foods: replay.state.foods,
        timeMs: result.time_ms,
        finalTick: body.final_tick,
        inputs: body.inputs.length,
        wraps: replay.state.wrapCount,
        restart: true,
        rotation: true,
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
