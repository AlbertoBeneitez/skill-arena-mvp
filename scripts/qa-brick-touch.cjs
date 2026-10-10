// Native mobile paddle control reads only forwarded Canvas drawing calls.
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core",
  ),
  assert = require("node:assert/strict"),
  { register } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  path = require("node:path");
register(pathToFileURL(path.join(__dirname, "determinism-loader.mjs")));
(async () => {
  const base = pathToFileURL(path.join(__dirname, "../.det-test/")).href,
    { BRICK_RELAY_CORE: core } = await import(
      base + "lib/verified/brickRelayCore.v2.js"
    ),
    { chooseBrickAction } = await import(
      base + "scripts/brick-play-fixture.js"
    ),
    { replayCore } = await import(base + "lib/verified/coreRuntime.v1.js");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const landscape = Boolean(process.env.QA_LANDSCAPE),
      context = await browser.newContext({
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
          playerName: "QA-Brick",
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
      const osc = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...a) {
        window.__oscillators++;
        return osc.apply(this, a);
      };
      const proto = CanvasRenderingContext2D.prototype,
        matches = (ctx) => ctx.canvas.classList?.contains("gameCanvas"),
        clear = proto.clearRect,
        rect = proto.fillRect,
        arc = proto.arc,
        move = proto.moveTo,
        line = proto.lineTo;
      proto.clearRect = function (...a) {
        if (matches(this))
          window.__scene = {
            t: performance.now(),
            bricks: [],
            ball: null,
            paddle: null,
          };
        return clear.apply(this, a);
      };
      const colors = [
        "#5e8fe8",
        "#6fd7c3",
        "#f0bb59",
        "#d97a8f",
        "#9f7ee2",
        "#8996b9",
      ];
      proto.fillRect = function (x, y, w, h, ...a) {
        if (matches(this) && window.__scene) {
          if (h === 20 && w >= 50 && colors.includes(this.fillStyle))
            window.__scene.bricks.push({
              x: x * 1000,
              y: y * 1000,
              w: w * 1000,
              h: h * 1000,
              hp: 1,
              kind: this.fillStyle === "#f0bb59" ? "blast" : "normal",
              drift: 0,
              period: 1,
              phase: 0,
            });
          if (h === 14 && this.fillStyle === "#6de0ef")
            window.__scene.paddle = { x: (x + w / 2) * 1000, w: w * 1000 };
        }
        return rect.call(this, x, y, w, h, ...a);
      };
      proto.arc = function (x, y, r, ...a) {
        if (
          matches(this) &&
          window.__scene &&
          r === 8 &&
          this.fillStyle === "#ffd864"
        )
          window.__scene.ball = { x: x * 1000, y: y * 1000 };
        return arc.call(this, x, y, r, ...a);
      };
      proto.moveTo = function (x, y, ...a) {
        this.__qaLineStart = { x, y };
        return move.call(this, x, y, ...a);
      };
      proto.lineTo = function (x, y, ...a) {
        const from = this.__qaLineStart,
          scene = window.__scene;
        if (
          matches(this) &&
          scene?.ball &&
          from &&
          this.lineWidth === 2 &&
          Math.abs(from.x * 1000 - scene.ball.x) < 0.01 &&
          Math.abs(from.y * 1000 - scene.ball.y) < 0.01
        )
          scene.velocity = {
            vx: Math.round(((from.x - x) * 1000) / 7),
            vy: Math.round(((from.y - y) * 1000) / 7),
          };
        return line.call(this, x, y, ...a);
      };
    });
    let starts = 0,
      submits = 0;
    page.on("request", (r) => {
      if (r.url().includes("/verified-match/start")) starts++;
      if (r.url().includes("/verified-match/verify")) submits++;
    });
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:3047");
    const started = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Brick Relay", exact: true })
      .tap();
    const issued = await (await started).json();
    assert.equal(issued.manifest.game_version, "2.0.0");
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    await page.locator(".verificationOverlay").waitFor({ state: "hidden" });
    const cdp = await context.newCDPSession(page),
      canvas = await page.locator("canvas.gameCanvas").boundingBox(),
      scale = Math.min(canvas.width / 390, canvas.height / 620),
      ox = (canvas.width - 390 * scale) / 2,
      oy = (canvas.height - 620 * scale) / 2;
    const point = (x) => ({
      x: canvas.x + ox + x * scale,
      y: canvas.y + oy + 540 * scale,
    });
    async function start(x) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point(x)],
      });
    }
    async function end(cancel = false) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
    }
    await start(230);
    await end(true);
    await start(195);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await end();
    await page
      .getByRole("button", { name: "Activar sonido", exact: true })
      .tap();
    // One rapid drag ends inside the aim cooldown: its last destination must stick.
    await start(120);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(270)],
    });
    await end();
    await page.waitForTimeout(500);
    const stoppedDrag = await page.evaluate(() => window.__scene?.paddle?.x);
    assert.ok(
      Math.abs(stoppedDrag - 270000) < 1000,
      "final touch destination survives cooldown without further moves",
    );
    await start(195);
    await end();
    await page.waitForTimeout(300);
    const boostButton = page.getByRole("button", {
      name: "Acelerar bola",
      exact: true,
    });
    const boostBox = await boostButton.boundingBox();
    assert.ok(boostBox.width >= 44 && boostBox.height >= 44);
    const boostPoint = {
      x: boostBox.x + boostBox.width / 2,
      y: boostBox.y + boostBox.height / 2,
    };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [boostPoint],
    });
    await page.waitForTimeout(100);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [boostPoint],
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    await page.waitForTimeout(2200);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [boostPoint],
    });
    await page.waitForTimeout(350);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(80);
    await start(process.env.QA_LOSS ? 350 : 195);
    if (process.env.QA_LOSS) {
      // Move away after the serve: leaving the paddle beneath a vertical
      // launch is intentionally safe, so it does not exercise a missed ball.
      await page.waitForTimeout(2500);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [point(70)],
      });
    }
    let done = false;
    const verified = page.waitForResponse(
      (r) => r.url().includes("/verified-match/verify"),
      { timeout: 360000 },
    );
    verified
      .then(() => {
        done = true;
      })
      .catch(() => {});
    let previous = null,
      lastX = 195,
      screenshot = false;
    for (let n = 0; !done && n < 15000; n++) {
      const scene = await page.evaluate(() => window.__scene);
      if (scene?.ball && scene.paddle) {
        const dt = previous ? ((scene.t - previous.t) * 120) / 1000 : 0,
          vx =
            scene.velocity?.vx ??
            (dt > 0 ? Math.round((scene.ball.x - previous.x) / dt) : 0),
          vy =
            scene.velocity?.vy ??
            (dt > 0 ? Math.round((scene.ball.y - previous.y) / dt) : 0);
        previous = { ...scene.ball, t: scene.t };
        if (
          process.env.QA_LOSS &&
          vy < 0 &&
          scene.ball.y < 540000 &&
          scene.ball.y > 520000
        ) {
          const x = scene.ball.x < 195000 ? 320 : 70;
          if (x !== lastX) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [point(x)],
            });
            lastX = x;
          }
        }
        if (!process.env.QA_LOSS) {
          const a = chooseBrickAction({
            ballX: scene.ball.x,
            ballY: scene.ball.y,
            vx,
            vy,
            bricks: scene.bricks,
            paddleX: scene.paddle.x,
            paddleW: scene.paddle.w,
            speed: Math.max(1500, Math.round(Math.hypot(vx, vy))),
            tick: 0,
          });
          const x = Number(a.slice(4)) * 5;
          if (x !== lastX) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [point(x)],
            });
            lastX = x;
          }
        }
        if (n % 600 === 0)
          console.log("progress", await page.locator(".coreHud").innerText());
        if (
          !screenshot &&
          scene.bricks.some((b) => b.kind === "blast") &&
          process.env.QA_SCREENSHOT
        ) {
          await page.screenshot({ path: process.env.QA_SCREENSHOT });
          screenshot = true;
        }
      }
      await page.waitForTimeout(20);
    }
    await end();
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
        boosted: replay.state.boosted,
        bricks: replay.state.destroyed,
        inputs: body.inputs.length,
      }),
    );
    assert.equal(result.verified, true);
    assert.ok(body.inputs.filter((i) => i.action === "BOOST_DOWN").length >= 2);
    assert.equal(
      body.inputs.filter((i) => i.action === "BOOST_DOWN").length,
      body.inputs.filter((i) => i.action === "BOOST_UP").length,
      "cancel/blur release boost in recorded replay",
    );
    assert.equal(replay.state.boosted, false);
    assert.equal(replay.valid, true, replay.error);
    assert.equal(result.score, replay.score);
    assert.equal(result.won, !process.env.QA_LOSS);
    assert.equal(starts, 1, "audio toggle does not reset attempt");
    assert.equal(submits, 1);
    if (!process.env.QA_LOSS) {
      assert.equal(replay.state.height, 69);
      assert.equal(replay.state.destroyed, 69);
    } else assert.equal(replay.failure, "BALL_LOST");
    await page.locator(".resultPanel").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    assert.ok((await page.evaluate(() => window.__oscillators)) > 0);
    await page.getByRole("button", { name: "CAMBIAR", exact: true }).tap();
    const restart = page.waitForResponse((r) =>
      r.url().includes("/verified-match/start"),
    );
    await page
      .getByRole("button", { name: "Jugar a Brick Relay", exact: true })
      .tap();
    const again = await (await restart).json();
    assert.notEqual(again.manifest.match_id, issued.manifest.match_id);
    await page.locator(".countdownOverlay").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    await page.setViewportSize(
      landscape ? { width: 390, height: 844 } : { width: 844, height: 390 },
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    assert.equal(await page.locator(".resultPanel").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        orientation: landscape ? "landscape" : "portrait",
        score: result.score,
        finalTick: body.final_tick,
        won: result.won,
        boosted: replay.state.boosted,
        lives: replay.state.lives,
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
