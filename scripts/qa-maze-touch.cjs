// Native touch QA. Planner reads forwarded drawing calls, never React/core state.
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
  const { MAZE_CORE_V3: core } = await import(
      base + "lib/verified/mazeRushCore.v3.js"
    ),
    { chooseMazeRoute } = await import(base + "scripts/maze-route-fixture.js"),
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
          playerName: "QA_Maze",
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
      window.__oscillators = 0;
      const tone = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...a) {
        window.__oscillators++;
        return tone.apply(this, a);
      };
      const p = CanvasRenderingContext2D.prototype,
        clear = p.clearRect,
        rect = p.fillRect,
        arc = p.arc,
        move = p.moveTo,
        text = p.fillText;
      const match = (c) => c.canvas.classList.contains("gameCanvas");
      p.clearRect = function (...a) {
        if (match(this))
          window.__mazeView = {
            walls: [],
            nodes: [],
            enemies: [],
            player: null,
            pulseSeconds: 0,
            pulseTicks: 0,
          };
        return clear.apply(this, a);
      };
      p.fillRect = function (x, y, w, h, ...a) {
        if (match(this) && window.__mazeView && this.fillStyle === "#233d5c")
          window.__mazeView.walls.push({ x, y, size: w + 2 });
        return rect.call(this, x, y, w, h, ...a);
      };
      p.arc = function (x, y, r, ...a) {
        if (match(this) && window.__mazeView) {
          if (
            this.strokeStyle === "#9cf0d6" &&
            a[0] === -Math.PI / 2 &&
            this.globalAlpha === 1
          )
            window.__mazeView.pulseTicks = Math.round(
              ((a[1] - a[0]) / (Math.PI * 2)) * 960,
            );
          if (this.fillStyle === "#d2e2f4")
            window.__mazeView.nodes.push({ x, y, pulse: false });
          if (this.fillStyle === "#9cf0d6")
            window.__mazeView.nodes.push({ x, y, pulse: true });
          if (
            ["#536782", "#b29c61", "#a281dc", "#ed8a91", "#efb876"].includes(
              this.fillStyle,
            )
          )
            window.__mazeView.enemies.push({
              x,
              y,
              awake: !["#536782", "#b29c61"].includes(this.fillStyle),
            });
        }
        return arc.call(this, x, y, r, ...a);
      };
      p.moveTo = function (x, y, ...a) {
        if (match(this) && window.__mazeView && this.fillStyle === "#87e8f3")
          window.__mazeView.player = { x, y };
        return move.call(this, x, y, ...a);
      };
      p.fillText = function (t, ...a) {
        if (
          match(this) &&
          window.__mazeView &&
          typeof t === "string" &&
          t.startsWith("PULSO ·")
        )
          window.__mazeView.pulseSeconds = Number(t.match(/(\d+) s/)[1]);
        return text.call(this, t, ...a);
      };
    });
    let starts = 0,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3050");
    const started = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Maze Rush", exact: true })
      .tap();
    const issued = await (await started).json();
    assert.equal(issued.manifest.game_version, "3.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => window.__mazeView?.nodes.length === 70 && window.__mazeView?.player,
    );
    const initialNodeCount = await page.evaluate(
      () => window.__mazeView.nodes.length,
    );
    const names = { STOP: "Detener movimiento" };
    const joystick = page.getByRole("group", {
      name: "Joystick de dirección",
      exact: true,
    });
    const stickBox = await joystick.boundingBox();
    assert.ok(stickBox.width >= 112 && stickBox.height >= 112);
    const stickPoint = (action) => ({
      x:
        stickBox.x +
        stickBox.width *
          (action === "LEFT" ? 0.15 : action === "RIGHT" ? 0.85 : 0.5),
      y:
        stickBox.y +
        stickBox.height *
          (action === "UP" ? 0.15 : action === "DOWN" ? 0.85 : 0.5),
    });
    // Start audio before native cancellation, which suppresses synthetic clicks.
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    // Swipe accepted while moving; cancel must not add a second action on release.
    const cdp = await context.newCDPSession(page),
      box = await page.locator("canvas.gameCanvas").boundingBox(),
      scale = Math.min(box.width / 390, box.height / 620),
      ox = (box.width - 390 * scale) / 2,
      oy = (box.height - 620 * scale) / 2;
    const point = (x) => ({
      x: box.x + ox + x * scale,
      y: box.y + oy + 550 * scale,
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(170)],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(210)],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.waitForTimeout(80); // Respect the real 6-tick input cooldown after the swipe.
    const stopBox = await page
      .getByRole("button", { name: names.STOP, exact: true })
      .boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: stopBox.x + stopBox.width / 2, y: stopBox.y + stopBox.height / 2 },
      ],
    });
    const activeStop = await page
      .getByRole("button", { name: names.STOP, exact: true })
      .boundingBox();
    assert.ok(
      activeStop.height >= 46 && activeStop.width >= 44,
      "held control keeps its full touch area",
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    // Cancel a fast drag: the common tick queue must retain its final STOP.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [stickPoint("RIGHT")],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [stickPoint("UP")],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    assert.equal(
      await joystick.locator(".stickThumb").evaluate((e) => e.style.transform),
      "translate(0px, 0px)",
    );
    let previousCell = null,
      changedAt = Date.now(),
      geometry = null,
      initialNodes = initialNodeCount,
      previousNodes = Infinity;
    let done = false,
      last = "STOP",
      stopped = false,
      screenshot = false;
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 240000 },
    );
    verified.then(() => (done = true)).catch(() => {});
    for (let turn = 0; !done && turn < 9000; turn++) {
      const view = await page.evaluate(() => window.__mazeView);
      if (view?.walls.length && view.player) {
        const cell = view.walls[0].size,
          minX = Math.min(...view.walls.map((p) => p.x)) - 1,
          minY = Math.min(...view.walls.map((p) => p.y)) - 1,
          width =
            Math.round(
              (Math.max(...view.walls.map((p) => p.x)) - minX - 1) / cell,
            ) + 1,
          height =
            Math.round(
              (Math.max(...view.walls.map((p) => p.y)) - minY - 1) / cell,
            ) + 1;
        const index = (p, player = false) =>
          Math.round((p.x - minX) / cell - 0.5) +
          width *
            Math.round((p.y + (player ? cell * 0.31 : 0) - minY) / cell - 0.5);
        const board = {
          width,
          height,
          walls: Array(width * height).fill(false),
          nodes: Array(width * height).fill(false),
          pulses: Array(width * height).fill(false),
          enemies: view.enemies.map((e) => ({
            cell: index(e),
            home: index(e),
            tie: 0,
            dormantUntil: e.awake ? 0 : 99999,
          })),
        };
        for (const p of view.walls)
          board.walls[
            Math.round((p.x - minX - 1) / cell) +
              width * Math.round((p.y - minY - 1) / cell)
          ] = true;
        for (const p of view.nodes) {
          board.nodes[index(p)] = true;
          board.pulses[index(p)] = p.pulse;
        }
        const signature = JSON.stringify({ width, height, walls: board.walls });
        geometry ??= signature;
        assert.equal(signature, geometry, "same corridors throughout the run");
        assert.equal(width, 11);
        assert.equal(height, 13);
        initialNodes ??= view.nodes.length;
        assert.equal(
          initialNodes,
          70,
          "all nodes visible before movement begins",
        );
        assert.ok(view.nodes.length <= previousNodes, "nodes never refill");
        previousNodes = view.nodes.length;
        const awake = view.enemies.some((e) => e.awake),
          tick = awake ? 1200 : 0;
        const observedCell = index(view.player, true);
        if (observedCell !== previousCell) {
          previousCell = observedCell;
          changedAt = Date.now();
        }
        const planningView = {
          board,
          player: observedCell,
          tick,
          poweredUntil: tick + view.pulseTicks,
          awake,
          pulseReserveTicks: 600, // Slower V3 traversal: seek protection before it expires.
          activeEnemyCells: view.enemies
            .filter((e) => e.awake)
            .map((e) => index(e)),
        };
        let action = chooseMazeRoute(planningView);
        if (loss) {
          if (initialNodes - view.nodes.length >= 24) stopped = true;
          if (stopped) action = "STOP";
        }
        if (
          action &&
          (action !== last ||
            (action !== "STOP" && Date.now() - changedAt > 500))
        ) {
          if (done || (await page.locator(".resultPanel").isVisible())) break;
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [stickPoint(action)],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          last = action;
          changedAt = Date.now();
        }
        if (
          !screenshot &&
          initialNodes - view.nodes.length >= 20 &&
          process.env.QA_SCREENSHOT
        ) {
          await page.screenshot({ path: process.env.QA_SCREENSHOT });
          screenshot = true;
        }
        if (turn % 600 === 0)
          console.log("progress", await page.locator(".coreHud").innerText());
      }
      await page.waitForTimeout(20);
    }
    const response = await verified,
      result = await response.json(),
      body = response.request().postDataJSON(),
      replay = replayCore(
        core,
        body.inputs,
        body.final_tick,
        issued.manifest.seed,
        issued.manifest.competition.target_score,
      );
    console.log(
      "result",
      JSON.stringify({
        result,
        nodes: replay.state.collected,
        total: replay.state.board.total,
        inputs: body.inputs.length,
      }),
    );
    assert.equal(result.verified, true);
    assert.ok(
      body.inputs.some(
        (input, i) =>
          i > 0 &&
          input.action === "STOP" &&
          body.inputs[i - 1].action !== "STOP",
      ),
      "cancelled movement has a recorded stop",
    );
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.height, replay.state.collected);
    assert.equal(result.time_ms, replay.timeMs);
    assert.equal(replay.state.tick, body.final_tick);
    assert.equal(result.won, !loss);
    if (loss) assert.equal(replay.failure, "PURSUER_COLLISION");
    else {
      assert.equal(replay.state.collected, replay.state.board.total);
      assert.equal(replay.state.board.nodes.some(Boolean), false);
    }
    assert.equal(starts, 1, "audio/callback changes do not reset play");
    assert.equal(submits, 1);
    assert.ok(await page.evaluate(() => window.__oscillators > 0));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      Number(
        await page
          .getByLabel("Avance del intento", { exact: true })
          .innerText(),
      ),
      replay.state.collected,
    );
    assert.equal(
      (await page.locator(".resultPanel").innerText()).includes("Puntos"),
      false,
    );
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page.getByRole("button", { name: "OTRA VEZ", exact: true }).tap();
    const next = await (await restart).json();
    assert.notEqual(next.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    await page.setViewportSize(
      landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
    );
    for (const b of await page.locator(".coreControls button").all()) {
      const r = await b.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44);
    }
    assert.equal(starts, 2, "orientation does not start again");
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: landscape ? "landscape" : "portrait",
        won: result.won,
        score: result.score,
        finalTick: body.final_tick,
        nodes: replay.state.collected,
        total: replay.state.board.total,
        lives: replay.state.lives,
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
